import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Btn, Vide } from "../../ui";
import { candidatsExamen, dateLisible } from "../../../dgecs";
import { sansComptabilite } from "../../../ecole-publique";
import { imprimerCandidatsExamen } from "../../../reports/dgecs-print";

const cellule = { padding: "7px 9px", borderBottom: "1px solid var(--lc-border-soft)", fontSize: 12.5 };
const entete = { padding: "8px 9px", fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--sc1)", textAlign: "start", whiteSpace: "nowrap" };
const manque = { background: "rgba(239,68,68,0.12)" };

// Candidats à l'examen de fin de cycle de la section (CEE, BEPC, BAC) : la
// liste à reporter sur la plateforme d'inscription, avec ce qui manque à
// chaque dossier — repéré avant la date limite, pas le dernier jour.
export function CandidatsVue({ eleves = [], section = "primaire", schoolInfo = {}, annee = "" }) {
  const { t } = useTranslation();
  const candidats = useMemo(() => candidatsExamen({ eleves, section, schoolInfo }), [eleves, section, schoolInfo]);
  const colonnes = ["colNumber", "colMatricule", "colLastName", "colFirstName", "colSex", "colBirthDate", "colBirthPlace", "colClass", "colMissing"];
  const style = (l, piece) => (l.manque.includes(piece) ? { ...cellule, ...manque } : cellule);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <strong style={{ fontSize: 14, flex: 1 }}>{t("dgecs.candidates.title", { examen: candidats.examen, niveau: candidats.niveau })}</strong>
        <Btn sm v="ghost" disabled={!candidats.lignes.length} onClick={() => imprimerCandidatsExamen(candidats, { schoolInfo, annee })}>{t("dgecs.print")}</Btn>
      </div>
      {!candidats.lignes.length ? <Vide icone="🎓" msg={t("dgecs.candidates.none", { niveau: candidats.niveau })} /> : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <Badge color="blue">{t("dgecs.candidates.count", { count: candidats.lignes.length })}</Badge>
            {candidats.incomplets > 0
              ? <Badge color="red">{t("dgecs.candidates.incomplete", { count: candidats.incomplets })}</Badge>
              : <Badge color="green">{t("dgecs.candidates.complete")}</Badge>}
            {candidats.doublons.length > 0 && <Badge color="red">{t("dgecs.notes.duplicates", { list: candidats.doublons.join(", ") })}</Badge>}
          </div>
          {candidats.incomplets > 0 && (
            <p style={{ fontSize: 12, color: "#92400e", margin: "0 0 8px" }}>
              {t(sansComptabilite(schoolInfo) ? "dgecs.candidates.hintPublic" : "dgecs.candidates.hintPrivate")}
            </p>
          )}
          <div style={{ overflowX: "auto", border: "1px solid var(--lc-border)", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 860 }}>
              <thead><tr>{colonnes.map((c) => <th key={c} style={entete}>{t(`dgecs.candidates.${c}`)}</th>)}</tr></thead>
              <tbody>{candidats.lignes.map((l) => (
                <tr key={l.eleve._id}>
                  <td style={{ ...cellule, color: "var(--lc-text-muted)" }}>{l.numero}</td>
                  <td style={{ ...style(l, "matricule"), fontFamily: "monospace", fontWeight: 700 }}>{l.matricule || "—"}</td>
                  <td style={{ ...cellule, fontWeight: 700 }}>{String(l.eleve.nom || "").toLocaleUpperCase("fr")}</td>
                  <td style={cellule}>{l.eleve.prenom}</td>
                  <td style={style(l, "sexe")}>{l.eleve.sexe || "—"}</td>
                  <td style={style(l, "dateNaissance")}>{dateLisible(l.eleve.dateNaissance) || "—"}</td>
                  <td style={style(l, "lieuNaissance")}>{l.eleve.lieuNaissance || "—"}</td>
                  <td style={cellule}>{l.eleve.classe}</td>
                  <td style={cellule}>{l.manque.length
                    ? l.manque.map((p) => t(`dgecs.candidates.pieces.${p}`)).join(", ")
                    : "✓"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--lc-text-faint)", margin: "8px 0 0" }}>{t("dgecs.candidates.registration")}</p>
        </>
      )}
    </div>
  );
}
