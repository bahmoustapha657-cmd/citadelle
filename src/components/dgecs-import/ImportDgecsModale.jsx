import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { genererMatricule, initMens } from "../../constants";
import { Btn, Modale } from "../ui";
import {
  URL_LISTE_DGECS, absentsDeDgecs, cocheParDefaut, ficheDepuisDgecs, lireListeDgecs, lireTexteTableau,
  champsDgecs, matriculeRemplace, rapprocherDgecs, resumeRapprochement,
} from "../../dgecs-import";
import { lireTableur } from "../../lecture-tableur";
import { ApercuDgecs } from "./ApercuDgecs";

// Pont DGECS → EduGest : la liste des élèves d'une classe, copiée sur
// dgecsecoles.com (bouton « copier ») ou exportée en Excel, est collée ici.
// EduGest retrouve ses élèves et leur pose le matricule DGECS (champ `ien`),
// recopie de DGECS (référence officielle) nom, prénoms, naissance et filiation
// quand leur fiche dit autre chose (coché d'office), inscrit ceux qui manquent (si `ajouter` est fourni) et liste ceux de la
// classe absents de DGECS. Logique : src/dgecs-import.js.
//
// Ouverte depuis Comptabilité → Enrôlement (écoles avec comptabilité) et
// École → DGECS (rattachement partout, inscription des écoles publiques).
export function ImportDgecsModale({
  section, classes = [], classeInitiale = "", eleves = [], tous = eleves, elevesSection = eleves,
  ajouter = null, modifierChamp = null, ensureClasse = null, schoolInfo, toast, logAction, fermer,
}) {
  const { t } = useTranslation();
  const [texte, setTexte] = useState("");
  const [lignesFichier, setLignesFichier] = useState(null);
  const [classe, setClasse] = useState(classeInitiale && classes.includes(classeInitiale) ? classeInitiale : "");
  const [decoches, setDecoches] = useState(() => new Set());
  // Lignes « à vérifier » : matricule DGECS → "" (à décider plus tard),
  // "nouveau" (élève différent, à inscrire) ou _id de l'élève d'EduGest qui
  // est le même (garder les données de DGECS : matricule, fiche recopiée).
  const [choix, setChoix] = useState(() => ({}));
  const [enCours, setEnCours] = useState(false);
  const [faits, setFaits] = useState(0);
  const verrou = useRef(false);

  const lecture = useMemo(() => {
    const tableau = lignesFichier || (texte.trim() ? lireTexteTableau(texte) : null);
    return tableau ? lireListeDgecs(tableau) : null;
  }, [texte, lignesFichier]);

  const lignes = useMemo(
    () => (lecture?.eleves?.length ? rapprocherDgecs(lecture.eleves, eleves, { tous }) : []),
    [lecture, eleves, tous],
  );
  const resume = resumeRapprochement(lignes);
  const elevesClasse = useMemo(() => eleves.filter((e) => e.classe === classe), [eleves, classe]);
  const absents = useMemo(() => (classe && lignes.length ? absentsDeDgecs(lignes, elevesClasse) : []), [lignes, elevesClasse, classe]);

  // Rattachements et nouveaux : cochés d'office, sauf décochés. Lignes « à
  // vérifier » : rien tant qu'on n'a pas choisi l'élève (ou « élève différent »).
  // Tout candidat peut être choisi, même s'il a déjà un autre matricule :
  // celui de DGECS le remplace (l'écran le dit avant d'appliquer).
  const peutAgir = (l) => (l.etat === "rattacher" && !!modifierChamp)
    || (l.etat === "nouveau" && !!ajouter)
    || (l.etat === "aVerifier" && (!!ajouter || !!modifierChamp));
  const estCoche = (l) => peutAgir(l) && (cocheParDefaut(l) ? !decoches.has(l.matricule) : !!choix[l.matricule]);
  const basculer = (l) => {
    const suite = new Set(decoches);
    if (suite.has(l.matricule)) suite.delete(l.matricule); else suite.add(l.matricule);
    setDecoches(suite);
  };
  const choisir = (l, valeur) => setChoix({ ...choix, [l.matricule]: valeur });
  const choisies = lignes.filter(estCoche);

  // Fiche conforme à DGECS (référence officielle) : ce que la fiche retrouvée
  // dit autrement, recopié de DGECS — coché d'office, décochable par ligne.
  const [gardees, setGardees] = useState(() => new Set());
  const candidatChoisi = (l) => (l.etat === "aVerifier" ? l.candidats.find((x) => x.eleve._id === choix[l.matricule]) : null);
  const ecartsDe = (l) => {
    if (!modifierChamp) return null;
    const ecarts = l.etat === "aVerifier" ? candidatChoisi(l)?.ecarts
      : (l.etat === "deja" || (l.etat === "rattacher" && estCoche(l))) ? l.ecarts : null;
    return ecarts && Object.keys(ecarts).length ? ecarts : null;
  };
  const corriger = (l) => !!ecartsDe(l) && !gardees.has(l.matricule);
  const basculerCorrection = (l) => {
    const suite = new Set(gardees);
    if (suite.has(l.matricule)) suite.delete(l.matricule); else suite.add(l.matricule);
    setGardees(suite);
  };
  const champsCorriges = (l) => (corriger(l) ? champsDgecs(ecartsDe(l)) : {});

  // { ligne, eleve, champs } : écritures sur des fiches existantes — matricule
  // DGECS posé (avec la fiche recopiée de DGECS si coché), ou fiche « déjà à
  // jour » seulement recopiée de DGECS.
  const aRattacher = choisies.flatMap((l) => {
    const eleve = l.etat === "rattacher" ? l.eleve : candidatChoisi(l)?.eleve;
    return eleve ? [{ ligne: l, eleve, champs: { ien: l.matricule, ...champsCorriges(l) } }] : [];
  });
  const aCorriger = lignes.filter((l) => l.etat === "deja" && corriger(l))
    .map((l) => ({ ligne: l, eleve: l.eleve, champs: champsCorriges(l) }));
  const nbCorrigees = aCorriger.length + aRattacher.filter((r) => Object.keys(r.champs).length > 1).length;
  const aInscrire = choisies.filter((l) => l.etat === "nouveau" || choix[l.matricule] === "nouveau");
  const total = aRattacher.length + aCorriger.length + aInscrire.length;
  // Une fiche ne reçoit qu'un matricule : déjà promise, elle n'est plus proposée.
  const fichesPromises = new Set(aRattacher.map((r) => r.eleve._id));
  const classeManque = aInscrire.length > 0 && !classe;

  const choisirFichier = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setLignesFichier(await lireTableur(await f.arrayBuffer(), { texte: true }));
      setTexte("");
      setDecoches(new Set());
      setChoix({});
      setGardees(new Set());
    } catch {
      toast?.(t("dgecs.import.fileError"), "warning");
    }
  };

  const appliquer = async () => {
    if (verrou.current || !total || classeManque) return;
    verrou.current = true;
    setEnCours(true);
    setFaits(0);
    let poses = 0;
    let remplaces = 0;
    let corrigees = 0;
    let echecs = 0;
    const ajoutes = [];
    let operations = 0;
    const avancer = () => setFaits(++operations);
    try {
      for (const { ligne, eleve, champs } of aRattacher) {
        try {
          await modifierChamp(eleve._id, champs);
          poses++;
          if (matriculeRemplace(ligne, eleve)) remplaces++;
          if (Object.keys(champs).length > 1) corrigees++;
        } catch { echecs++; }
        avancer();
      }
      for (const { eleve, champs } of aCorriger) {
        try { await modifierChamp(eleve._id, champs); corrigees++; } catch { echecs++; }
        avancer();
      }
      if (aInscrire.length && ensureClasse) await ensureClasse(classe);
      for (const l of aInscrire) {
        const fiche = {
          ...ficheDepuisDgecs(l, { classe }), niveau: section, mens: initMens(),
          // Valeur enregistrée en français, comme à l'enrôlement. i18n-ignore
          typeInscription: "Première inscription",
          matricule: genererMatricule([...elevesSection, ...ajoutes], section, schoolInfo),
        };
        try { await ajouter(fiche); ajoutes.push(fiche); } catch { echecs++; }
        avancer();
      }
      toast?.(t("dgecs.import.done", { linked: poses, fixed: corrigees, enrolled: ajoutes.length }), echecs ? "warning" : "success");
      if (echecs) toast?.(t("dgecs.import.failed", { count: echecs }), "error");
      // Journal de l'école : en français, comme toutes ses entrées. i18n-ignore
      if (poses || corrigees || ajoutes.length) logAction?.("Import depuis DGECS", `${poses} matricule(s) posé(s)${remplaces ? ` (dont ${remplaces} à la place d'un autre matricule)` : ""}, ${corrigees} fiche(s) recopiée(s) de DGECS, ${ajoutes.length} élève(s) inscrit(s)${classe ? ` en ${classe}` : ""}`);
      if (!echecs) fermer();
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  };

  const etape = { fontSize: 13, color: "#334155", margin: "0 0 6px", lineHeight: 1.6 };
  return (
    <Modale xlarge titre={t("dgecs.import.title")} fermer={enCours ? () => {} : fermer}>
      <ol style={{ margin: "0 0 12px", paddingInlineStart: 20 }}>
        <li style={etape}>
          {t("dgecs.import.step1")}{" "}
          <a href={URL_LISTE_DGECS} target="_blank" rel="noreferrer" style={{ color: "#0a7d5a", fontWeight: 700 }}>{t("dgecs.import.openDgecs")}</a>
        </li>
        <li style={etape}>{t("dgecs.import.step2")}</li>
        <li style={etape}>{t("dgecs.import.step3")}</li>
      </ol>

      <label htmlFor="dgecs-import-texte" style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#0A1628", marginBottom: 6 }}>
        {t("dgecs.import.pasteLabel")}
      </label>
      <textarea id="dgecs-import-texte" value={texte} rows={lecture ? 3 : 7}
        onChange={(e) => { setTexte(e.target.value); setLignesFichier(null); setDecoches(new Set()); setChoix({}); setGardees(new Set()); }}
        placeholder={t("dgecs.import.pastePlaceholder")}
        style={{ width: "100%", border: "1px solid #b0c4d8", borderRadius: 9, padding: "10px 12px", fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "8px 0 14px", fontSize: 12, color: "#64748b" }}>
        <span>{t("dgecs.import.orFile")}</span>
        <input type="file" accept=".xlsx,.xls,.csv" aria-label={t("dgecs.import.fileLabel")} onChange={choisirFichier} style={{ fontSize: 12 }} />
        {lignesFichier && <strong style={{ color: "#065f46" }}>{t("dgecs.import.fileRead")}</strong>}
      </div>

      {lecture?.erreur && (
        <p role="alert" style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>{t(`dgecs.import.readError.${lecture.erreur}`)}</p>
      )}

      {lignes.length > 0 && (
        <ApercuDgecs
          lignes={lignes} resume={resume} absents={absents} classes={classes} classe={classe} setClasse={setClasse}
          estCoche={estCoche} peutAgir={peutAgir} basculer={basculer} peutInscrire={!!ajouter} peutRattacher={!!modifierChamp}
          choix={choix} choisir={choisir} fichesPromises={fichesPromises}
          ecartsDe={ecartsDe} corriger={corriger} basculerCorrection={basculerCorrection}
        />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {classeManque && <span role="alert" style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>{t("dgecs.import.chooseClass")}</span>}
        {enCours && <span style={{ fontSize: 12, color: "#64748b" }}>{t("dgecs.import.progress", { done: faits, total })}</span>}
        <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("common.cancel")}</Btn>
        <Btn v="vert" onClick={appliquer} disabled={enCours || !total || classeManque}>
          {t("dgecs.import.apply", { linked: aRattacher.length, fixed: nbCorrigees, enrolled: aInscrire.length })}
        </Btn>
      </div>
    </Modale>
  );
}
