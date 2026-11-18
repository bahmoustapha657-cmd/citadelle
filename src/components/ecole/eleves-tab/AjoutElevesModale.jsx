import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, genererMatricule, initMens } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { ERREUR_DEJA_LA, classeRetenue, lireListeEleves } from "./liste-eleves-collee";

const titreChamp = { display: "block", fontSize: 11, fontWeight: 800, color: C.blueDark, textTransform: "uppercase", letterSpacing: "0.06em" };

// Espace d'un enseignant indépendant : il inscrit lui-même les élèves de ses
// classes, sans passer par la Comptabilité (absente de son espace). Une
// classe, puis la liste tapée ou collée, un élève par ligne ; aperçu avant
// d'enregistrer.
export function AjoutElevesModale({
  classes = [], eleves = [], section, schoolInfo, ajouter, toast, logAction, fermer, classeInitiale = "",
}) {
  const { t } = useTranslation();
  const nomsClasses = useMemo(() => [...new Set(classes.map((c) => c.nom).filter(Boolean))], [classes]);
  const [choix, setClasse] = useState(classeInitiale);
  const classe = classeRetenue(choix, nomsClasses);
  const [texte, setTexte] = useState("");
  const [prenomDabord, setPrenomDabord] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [faits, setFaits] = useState(0);
  const verrou = useRef(false);

  const lignes = useMemo(
    () => lireListeEleves(texte, { prenomDabord, classe, existants: eleves }),
    [texte, prenomDabord, classe, eleves],
  );
  const aInscrire = lignes.filter((l) => !l.erreur);
  const titre = `➕ ${t("school.students.teacherAdd.button")}`;

  const enregistrer = async () => {
    if (verrou.current || !classe || !aInscrire.length) return;
    verrou.current = true;
    setEnCours(true);
    setFaits(0);
    // Les matricules suivent ceux de la section, élèves ajoutés compris :
    // la liste chargée ne se recharge qu'après coup.
    const ajoutes = [];
    try {
      for (const l of aInscrire) {
        const eleve = {
          nom: l.nom, prenom: l.prenom, sexe: l.sexe, classe, niveau: section,
          // Valeurs enregistrées en français, comme à l'enrôlement. i18n-ignore
          statut: "Actif", typeInscription: "Première inscription", mens: initMens(),
          matricule: genererMatricule([...eleves, ...ajoutes], section, schoolInfo),
        };
        await ajouter(eleve);
        ajoutes.push(eleve);
        setFaits(ajoutes.length);
      }
      toast(t("school.students.teacherAdd.done", { classe, count: ajoutes.length }), "success");
      // Journal de l'école : en français, comme toutes ses entrées. i18n-ignore
      logAction?.("Élèves inscrits par l'enseignant", `${ajoutes.length} en ${classe}`);
      fermer();
    } catch (e) {
      toast(t("school.students.teacherAdd.interrupted", { count: ajoutes.length, error: e?.message || e }), "error");
      // Les élèves déjà enregistrés ne doivent pas l'être une seconde fois :
      // il ne reste dans la zone de saisie que ceux qui ne le sont pas.
      setTexte(aInscrire.slice(ajoutes.length).map((l) => l.ligne).join("\n"));
    } finally {
      setEnCours(false);
      verrou.current = false;
    }
  };

  if (!nomsClasses.length) {
    return (
      <Modale titre={titre} fermer={fermer}>
        <p style={{ fontSize: 13, color: "var(--lc-text)", margin: "0 0 14px" }}>
          {t("school.students.teacherAdd.noClass")}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={fermer}>{t("school.students.teacherAdd.understood")}</Btn>
        </div>
      </Modale>
    );
  }

  return (
    <Modale titre={titre} fermer={enCours ? () => {} : fermer}>
      <label htmlFor="ajout-classe" style={titreChamp}>{t("enrolment.class")}</label>
      <select id="ajout-classe" value={classe} onChange={(e) => setClasse(e.target.value)} disabled={enCours}
        style={{ width: "100%", border: "1px solid #b0c4d8", borderRadius: 7, padding: "8px 10px", fontSize: 13, background: "var(--lc-input-bg, #fff)", color: "var(--lc-text)", margin: "4px 0 12px" }}>
        {nomsClasses.map((c) => <option key={c}>{c}</option>)}
      </select>

      <label htmlFor="liste-eleves" style={titreChamp}>{t("school.students.teacherAdd.listLabel")}</label>
      <textarea id="liste-eleves" value={texte} onChange={(e) => setTexte(e.target.value)} disabled={enCours}
        // Noms d'exemple guinéens : les mêmes dans toutes les langues. i18n-ignore
        rows={8} placeholder={"BAH Aminata F\nDIALLO Mamadou Saliou M\nCAMARA Fatoumata F"}
        style={{ width: "100%", boxSizing: "border-box", border: "1px solid #b0c4d8", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", marginTop: 4, background: "var(--lc-input-bg, #fff)", color: "var(--lc-text)" }} />
      <p style={{ fontSize: 11.5, color: "var(--lc-text-muted, #64748b)", margin: "4px 0 8px" }}>
        {t("school.students.teacherAdd.help")}
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--lc-text-muted, #475569)", cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={prenomDabord} onChange={(e) => setPrenomDabord(e.target.checked)} disabled={enCours} />
        {t("school.students.teacherAdd.firstNameFirst")}
      </label>

      {lignes.length > 0 && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--lc-border, #e5e7eb)", borderRadius: 8, marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--lc-surface-alt, #f8fafc)", textAlign: "start" }}>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("enrolment.lastName")}</th>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("enrolment.firstName")}</th>
                <th style={{ padding: "6px 8px", textAlign: "start" }}>{t("enrolment.sex")}</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={`${i}-${l.ligne}`} style={{ borderTop: "1px solid var(--lc-border, #f1f5f9)", background: l.erreur ? "rgba(239,68,68,0.08)" : undefined }}>
                  {l.erreur
                    ? <td colSpan={3} style={{ padding: "5px 8px", color: "#b91c1c" }}>
                      « {l.ligne} » — {t(l.erreur === ERREUR_DEJA_LA
                        ? "school.students.teacherAdd.errAlready"
                        : "school.students.teacherAdd.errNameFirstName")}
                    </td>
                    : <>
                      <td style={{ padding: "5px 8px", fontWeight: 700 }}>{l.nom}</td>
                      <td style={{ padding: "5px 8px" }}>{l.prenom}</td>
                      <td style={{ padding: "5px 8px", color: l.sexeIndique ? undefined : "#94a3b8" }}>{l.sexe}</td>
                    </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {enCours && <span style={{ fontSize: 12, color: "var(--lc-text-muted, #475569)" }}>⏳ {faits} / {aInscrire.length}</span>}
        <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("common.cancel")}</Btn>
        <Btn onClick={enregistrer} disabled={enCours || !aInscrire.length}>
          ✅ {t("school.students.teacherAdd.submit", { count: aInscrire.length })}
        </Btn>
      </div>
    </Modale>
  );
}
