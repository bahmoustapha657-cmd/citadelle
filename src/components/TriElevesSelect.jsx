import { C } from "../constants";
import { CRITERES_TRI } from "../tri-eleves";

// Liste déroulante « Trier : … » des listes d'élèves (cf. tri-eleves.js et
// use-tri-eleves.js pour la mémorisation du choix).
export function TriElevesSelect({ liste, value, onChange }) {
  const actif = value && value !== "alpha";
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", fontWeight: 600 }}>
      ↕️ Trier
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${actif ? C.blue : "#b0c4d8"}`, borderRadius: 7, padding: "6px 10px", fontSize: 12,
          background: actif ? "#f0f6ff" : "#fff", color: C.blueDark, fontWeight: 600,
        }}>
        {(CRITERES_TRI[liste] || []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </label>
  );
}
