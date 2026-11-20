import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { genererMatricule, initMens } from "../../constants";
import { Btn, Modale } from "../ui";
import {
  URL_LISTE_DGECS, absentsDeDgecs, cocheParDefaut, ficheDepuisDgecs, lireListeDgecs, lireTexteTableau,
  rapprocherDgecs, resumeRapprochement,
} from "../../dgecs-import";
import { lireTableur } from "../../lecture-tableur";
import { ApercuDgecs } from "./ApercuDgecs";

// Pont DGECS → EduGest : la liste des élèves d'une classe, copiée sur
// dgecsecoles.com (bouton « copier ») ou exportée en Excel, est collée ici.
// EduGest retrouve ses élèves et leur pose le matricule DGECS (champ `ien`),
// inscrit ceux qui manquent (si `ajouter` est fourni) et liste ceux de la
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
  const [coches, setCoches] = useState(() => new Set());
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

  // Coché = coché d'office (rattachements, nouveaux) sauf décoché, ou coché
  // à la main (homonymes « à vérifier » inscrits malgré tout).
  const peutAgir = (l) => (l.etat === "rattacher" && !!modifierChamp)
    || ((l.etat === "nouveau" || l.etat === "aVerifier") && !!ajouter);
  const estCoche = (l) => peutAgir(l) && (cocheParDefaut(l) ? !decoches.has(l.matricule) : coches.has(l.matricule));
  const basculer = (l) => {
    const [ens, setEns] = cocheParDefaut(l) ? [decoches, setDecoches] : [coches, setCoches];
    const suite = new Set(ens);
    if (suite.has(l.matricule)) suite.delete(l.matricule); else suite.add(l.matricule);
    setEns(suite);
  };
  const choisies = lignes.filter(estCoche);
  const aRattacher = choisies.filter((l) => l.etat === "rattacher");
  const aInscrire = choisies.filter((l) => l.etat !== "rattacher");
  const classeManque = aInscrire.length > 0 && !classe;

  const choisirFichier = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setLignesFichier(await lireTableur(await f.arrayBuffer(), { texte: true }));
      setTexte("");
    } catch {
      toast?.(t("dgecs.import.fileError"), "warning");
    }
  };

  const appliquer = async () => {
    if (verrou.current || !choisies.length || classeManque) return;
    verrou.current = true;
    setEnCours(true);
    setFaits(0);
    let poses = 0;
    let echecs = 0;
    const ajoutes = [];
    try {
      for (const l of aRattacher) {
        try { await modifierChamp(l.eleve._id, { ien: l.matricule }); poses++; } catch { echecs++; }
        setFaits(poses + ajoutes.length + echecs);
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
        setFaits(poses + ajoutes.length + echecs);
      }
      toast?.(t("dgecs.import.done", { linked: poses, enrolled: ajoutes.length }), echecs ? "warning" : "success");
      if (echecs) toast?.(t("dgecs.import.failed", { count: echecs }), "error");
      // Journal de l'école : en français, comme toutes ses entrées. i18n-ignore
      if (poses || ajoutes.length) logAction?.("Import depuis DGECS", `${poses} matricule(s) posé(s), ${ajoutes.length} élève(s) inscrit(s)${classe ? ` en ${classe}` : ""}`);
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
        onChange={(e) => { setTexte(e.target.value); setLignesFichier(null); setDecoches(new Set()); setCoches(new Set()); }}
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
        />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {classeManque && <span role="alert" style={{ fontSize: 12, color: "#b45309", fontWeight: 700 }}>{t("dgecs.import.chooseClass")}</span>}
        {enCours && <span style={{ fontSize: 12, color: "#64748b" }}>{t("dgecs.import.progress", { done: faits, total: choisies.length })}</span>}
        <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("common.cancel")}</Btn>
        <Btn v="vert" onClick={appliquer} disabled={enCours || !choisies.length || classeManque}>
          {t("dgecs.import.apply", { linked: aRattacher.length, enrolled: aInscrire.length })}
        </Btn>
      </div>
    </Modale>
  );
}
