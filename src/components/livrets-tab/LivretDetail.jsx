import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { imprimerLivret } from "../../reports";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../ui";
import { AnneeModal } from "./AnneeModal";

// Vue détail d'un livret : en-tête, liste des années saisies et modal de saisie.
export function LivretDetail({ h }) {
  const { t } = useTranslation();
  const { livretSel, eleves, schoolInfo, periodes, maxNote, canEdit, modal, formAnnee } = h;
  const eleve = eleves.find(e => e._id === livretSel.eleveId) || {};

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Btn sm v="ghost" onClick={() => h.setLivretSelId(null)}>← {t("common.back")}</Btn>
        <strong style={{ fontSize: 14, color: C.blueDark, flex: 1 }}>
          📋 Livret — {livretSel.eleveNom} · <span style={{ fontFamily: "monospace", color: C.blue }}>{livretSel.numeroLivret}</span>
        </strong>
        <Btn sm v="vert" onClick={() => imprimerLivret({ ...livretSel, photo: eleve.photo || livretSel.photo }, schoolInfo)}>🖨️ Imprimer le livret</Btn>
        {canEdit && <Btn sm v="blue" onClick={() => { h.setFormAnnee({ ...h.preRemplirAnnee(eleve) }); h.setModal("annee"); }}>+ Nouvelle année</Btn>}
      </div>

      {(livretSel.annees || []).length === 0
        ? <Vide icone="📅" msg="Aucune année saisie — cliquez sur '+ Nouvelle année'" />
        : (livretSel.annees || []).map((an, idx) => (
          <Card key={idx} style={{ marginBottom: 14, border: `2px solid ${an.signe ? "#86efac" : "#e5e7eb"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: an.signe ? "#f0fdf4" : "#f8fafc", borderRadius: "14px 14px 0 0" }}>
              <strong style={{ flex: 1, fontSize: 13, color: C.blueDark }}>Année {an.anneeScolaire} — {an.classe}</strong>
              <Badge color={an.decision === "Admis avec félicitations" || an.decision === "Admis" ? "vert" : an.decision === "Redoublant" ? "amber" : "red"}>{an.decision || "—"}</Badge>
              {an.signe
                ? <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>✅ Signé le {an.dateSigne}</span>
                : canEdit && <>
                    <Btn sm v="ghost" onClick={() => { h.setFormAnnee({ ...an, _idx: idx }); h.setModal("annee"); }}>✏️ Modifier</Btn>
                    <Btn sm v="vert" onClick={() => h.signerAnnee(livretSel._id, idx)}>✍️ Signer</Btn>
                  </>
              }
            </div>
            <div style={{ padding: "12px 16px", fontSize: 12 }}>
              <div style={{ display: "flex", gap: 20, marginBottom: 8, flexWrap: "wrap", color: "#374151" }}>
                <span>Enseignant : <strong>{an.enseignantPrincipal || "—"}</strong></span>
                <span>Rang : <strong>{an.rang || "—"}/{an.effectifClasse || "—"}</strong></span>
                <span>Abs. justifiées : <strong>{an.absences?.justifiees || 0}</strong></span>
                <span>Abs. non just. : <strong>{an.absences?.nonJustifiees || 0}</strong></span>
              </div>
              {an.appreciation && <div style={{ fontStyle: "italic", color: "#6b7280", marginBottom: 6 }}>"{an.appreciation}"</div>}
              <details><summary style={{ cursor: "pointer", color: C.blue, fontSize: 12, fontWeight: 700 }}>Voir les notes ({(an.notes || []).length} matières)</summary>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 11 }}>
                  <THead cols={["Matière", "Coef", ...periodes, "Annuelle"]} />
                  <tbody>{(an.notes || []).map((n, i) => <TR key={i}>
                    <TD bold>{n.matiere}</TD><TD center>{n.coef}</TD>
                    {periodes.map(p => <TD key={p} center>{n[p] != null ? Number(n[p]).toFixed(1) : "—"}</TD>)}
                    <TD center><strong style={{ color: n.annuelle >= maxNote / 2 ? "#15803d" : "#b91c1c" }}>{n.annuelle != null ? Number(n.annuelle).toFixed(2) : "—"}</strong></TD>
                  </TR>)}</tbody>
                </table>
              </details>
            </div>
          </Card>
        ))
      }

      {modal === "annee" && <AnneeModal
        formAnnee={formAnnee} setFormAnnee={h.setFormAnnee} setModal={h.setModal}
        periodes={periodes} maxNote={maxNote} savingL={h.savingL}
        sauvegarderAnnee={h.sauvegarderAnnee} chgAnnee={h.chgAnnee} chgAbs={h.chgAbs}
      />}
    </div>
  );
}
