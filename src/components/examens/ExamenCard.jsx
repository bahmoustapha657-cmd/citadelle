import { Btn, Card } from "../ui";
import { getEvaluationLabel } from "../../evaluation-forms";

// Carte d'un examen à venir : détails, badges et actions (convocations, édition,
// suppression).
export function ExamenCard({ ex, schoolInfo, c1, c2, genererConvocations, setForm, setModal, supEx }) {
  return (
    <Card style={{ border: `1px solid ${c1}22` }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14, color: c1 }}>{ex.titre}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{getEvaluationLabel(ex.type, schoolInfo, { kind: "exam" })} · {ex.classe || "Toutes classes"}</div>
          </div>
          <div style={{ background: `${c2}22`, color: c1, fontWeight: 800, fontSize: 12, padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap" }}>{ex.date || "—"}</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {ex.heure && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 6, color: "#475569" }}>🕐 {ex.heure}</span>}
          {ex.salle && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 6, color: "#475569" }}>📍 {ex.salle}</span>}
          {ex.matiere && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 6, color: "#475569" }}>📚 {ex.matiere}</span>}
          {ex.duree && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 8px", borderRadius: 6, color: "#475569" }}>⏱ {ex.duree}</span>}
        </div>
        {ex.consignes && <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 10px", padding: "6px 10px", background: "#f8fafc", borderRadius: 6, lineHeight: 1.5 }}>{ex.consignes}</p>}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Btn sm v="vert" onClick={() => genererConvocations(ex)}>🖨️ Convocations</Btn>
          <Btn sm v="ghost" onClick={() => { setForm({ ...ex }); setModal("edit"); }}>✏️</Btn>
          <Btn sm v="danger" onClick={() => { if (confirm("Supprimer ?")) supEx(ex._id); }}>🗑️</Btn>
        </div>
      </div>
    </Card>
  );
}
