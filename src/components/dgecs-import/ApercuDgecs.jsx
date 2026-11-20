import { useState } from "react";
import { useTranslation } from "react-i18next";

// Couleurs des états (cf. rapprocherDgecs dans src/dgecs-import.js).
const COULEURS = {
  deja: ["#f1f5f9", "#475569"],
  rattacher: ["#e0f2fe", "#075985"],
  nouveau: ["#dcfce7", "#166534"],
  conflit: ["#fee2e2", "#991b1b"],
  aVerifier: ["#fef3c7", "#92400e"],
  invalide: ["#fee2e2", "#991b1b"],
};
const ORDRE = ["rattacher", "nouveau", "aVerifier", "conflit", "deja", "invalide"];
// Champs de la fiche que DGECS peut corriger, dans l'ordre d'affichage.
const CHAMPS_FICHE = ["nom", "prenom", "dateNaissance", "lieuNaissance", "filiation"];

const Pastille = ({ etat, children }) => {
  const [bg, fg] = COULEURS[etat] || COULEURS.deja;
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
};

// Aperçu du rapprochement : classe des nouveaux élèves, compteurs par état,
// une ligne par élève de la liste DGECS (case = action proposée ; menu pour
// les lignes « à vérifier » : quel élève d'EduGest est le même), puis les
// élèves de la classe qu'EduGest connaît mais que DGECS n'a pas.
export function ApercuDgecs({
  lignes, resume, absents, classes, classe, setClasse, estCoche, peutAgir, basculer, peutInscrire, peutRattacher,
  choix = {}, choisir, lierPossible = () => false, fichesPromises = new Set(),
  ecartsDe = () => null, corriger = () => false, basculerCorrection,
}) {
  const { t } = useTranslation();
  const [voirAbsents, setVoirAbsents] = useState(false);
  const triees = [...lignes].sort((a, b) => ORDRE.indexOf(a.etat) - ORDRE.indexOf(b.etat));
  const th = { textAlign: "start", padding: "8px 10px", fontSize: 11, fontWeight: 800, color: "#475569", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" };
  const td = { padding: "7px 10px", fontSize: 12.5, color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" };

  const nomEleve = (e) => `${e.nom} ${e.prenom}`;
  const preuves = (codes = []) => codes.map((c) => t(`dgecs.import.evidence.${c}`)).join(", ");
  const detail = (l) => {
    if (l.etat === "invalide") return [...l.erreurs, ...l.avertissements].map((c) => t(`dgecs.import.issues.${c}`)).join(" · ");
    const v = l.eleve ? { name: nomEleve(l.eleve), classe: l.eleve.classe || "—", preuves: preuves(l.preuves), ien: l.eleve.ien } : {};
    if (l.etat === "deja") return t("dgecs.import.detail.deja", v);
    if (l.etat === "rattacher" && l.orthographe) return t(l.sur ? "dgecs.import.detail.rattacherProche" : "dgecs.import.detail.rattacherSonore", v);
    if (l.etat === "rattacher") return t(l.sur ? "dgecs.import.detail.rattacherSur" : "dgecs.import.detail.rattacher", v);
    if (l.etat === "conflit") return t("dgecs.import.detail.conflit", v);
    if (l.etat === "aVerifier") return t("dgecs.import.detail.aVerifier");
    return peutInscrire ? t("dgecs.import.detail.nouveau") : t("dgecs.import.detail.nouveauSansInscription");
  };

  // Fiche EduGest qui dit autre chose que DGECS (référence officielle) :
  // avant → après, recopié de DGECS si la case reste cochée.
  const correction = (l) => {
    const ecarts = ecartsDe(l);
    return (
      <div style={{ marginTop: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "6px 9px" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 700, color: "#166534", cursor: "pointer" }}>
          <input type="checkbox" checked={corriger(l)} onChange={() => basculerCorrection(l)}
            aria-label={t("dgecs.import.fix.label", { name: `${l.nom} ${l.prenom}` })} />
          {t("dgecs.import.fix.title")}
        </label>
        <ul style={{ margin: "4px 0 0", paddingInlineStart: 22 }}>
          {CHAMPS_FICHE.filter((c) => ecarts[c]).map((c) => (
            <li key={c}>
              {t(`dgecs.import.fields.${c}`)} : <s style={{ color: "#94a3b8" }}>{ecarts[c][0] || "—"}</s> → <strong style={{ color: "#14532d" }}>{ecarts[c][1]}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Ligne « à vérifier » : les élèves d'EduGest qui pourraient être lui, et
  // le choix (le même élève → matricule posé ; élève différent → inscrit).
  const candidats = (l) => (
    <>
      <ul style={{ margin: "4px 0 6px", paddingInlineStart: 18 }}>
        {l.candidats.map((c) => (
          <li key={c.eleve._id}>
            <strong>{nomEleve(c.eleve)}</strong> ({c.eleve.classe || "—"}{c.eleve.dateNaissance ? `, ${c.eleve.dateNaissance}` : ""})
            {c.eleve.ien ? ` · ${c.eleve.ien}` : ""} — {preuves(c.preuves)}
          </li>
        ))}
      </ul>
      {peutAgir(l) && (
        <select value={choix[l.matricule] || ""} onChange={(e) => choisir(l, e.target.value)}
          aria-label={t("dgecs.import.choice.label", { name: `${l.nom} ${l.prenom}` })}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "5px 8px", fontSize: 12, background: "#fff", maxWidth: "100%" }}>
          <option value="">{t("dgecs.import.choice.none")}</option>
          {peutRattacher && l.candidats.filter(lierPossible).map((c) => (
            <option key={c.eleve._id} value={c.eleve._id} disabled={fichesPromises.has(c.eleve._id) && choix[l.matricule] !== c.eleve._id}>
              {t("dgecs.import.choice.link", { name: nomEleve(c.eleve), classe: c.eleve.classe || "—" })}
            </option>
          ))}
          {peutInscrire && <option value="nouveau">{t("dgecs.import.choice.new")}</option>}
        </select>
      )}
    </>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {ORDRE.filter((e) => resume[e]).map((e) => (
          <Pastille key={e} etat={e}>{t(`dgecs.import.states.${e}`)} : {resume[e]}</Pastille>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label htmlFor="dgecs-import-classe" style={{ fontSize: 12, fontWeight: 800, color: "#0A1628" }}>{t("dgecs.import.classLabel")}</label>
        <select id="dgecs-import-classe" value={classe} onChange={(e) => setClasse(e.target.value)}
          style={{ border: "1px solid #b0c4d8", borderRadius: 7, padding: "6px 10px", fontSize: 13, background: "#fff", minWidth: 180 }}>
          <option value="">{t("dgecs.import.classPlaceholder")}</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: "#64748b" }}>{t("dgecs.import.classHint")}</span>
      </div>
      {!peutRattacher && <p style={{ fontSize: 12, color: "#b45309", margin: "0 0 8px" }}>{t("dgecs.import.cannotLink")}</p>}

      <div style={{ maxHeight: "42vh", overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 9 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th} aria-label={t("dgecs.import.cols.select")} />
              <th style={th}>{t("dgecs.import.cols.matricule")}</th>
              <th style={th}>{t("dgecs.import.cols.student")}</th>
              <th style={th}>{t("dgecs.import.cols.sex")}</th>
              <th style={th}>{t("dgecs.import.cols.birth")}</th>
              <th style={th}>{t("dgecs.import.cols.state")}</th>
              <th style={th}>{t("dgecs.import.cols.detail")}</th>
            </tr>
          </thead>
          <tbody>
            {triees.map((l, i) => (
              <tr key={`${l.matricule}-${l.ligne}-${i}`} data-testid="ligne-dgecs" data-etat={l.etat}>
                <td style={td}>
                  {peutAgir(l) && l.etat !== "aVerifier" && (
                    <input type="checkbox" checked={estCoche(l)} onChange={() => basculer(l)}
                      aria-label={t("dgecs.import.selectRow", { name: `${l.nom} ${l.prenom}` })} />
                  )}
                </td>
                <td style={{ ...td, fontFamily: "monospace" }}>{l.matricule || "—"}</td>
                <td style={td}><strong>{l.nom}</strong> {l.prenom}</td>
                <td style={td}>{l.sexe || "—"}</td>
                <td style={td}>{l.dateNaissance || "—"}{l.lieuNaissance ? ` · ${l.lieuNaissance}` : ""}</td>
                <td style={td}><Pastille etat={l.etat}>{t(`dgecs.import.states.${l.etat}`)}</Pastille></td>
                <td style={{ ...td, color: "#475569" }}>
                  {detail(l)}
                  {l.etat === "aVerifier" && candidats(l)}
                  {ecartsDe(l) && correction(l)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {classe && absents.length > 0 && (
        <div style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, padding: "10px 12px" }}>
          <button type="button" onClick={() => setVoirAbsents(!voirAbsents)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#92400e", textAlign: "start" }}>
            {voirAbsents ? "▼" : "▶"} {t("dgecs.import.absents", { count: absents.length, classe })}
          </button>
          {voirAbsents && (
            <ul style={{ margin: "8px 0 0", paddingInlineStart: 20, fontSize: 12.5, color: "#78350f" }}>
              {absents.map((e) => <li key={e._id}>{e.nom} {e.prenom}{e.ien ? ` — ${e.ien}` : ""}</li>)}
            </ul>
          )}
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#92400e" }}>{t("dgecs.import.absentsHint")}</p>
        </div>
      )}
    </div>
  );
}
