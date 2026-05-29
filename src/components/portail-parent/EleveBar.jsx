import { C } from "../../constants";
import { normalizeText } from "./helpers";

// Barre d'identité de l'enfant courant : avatar, classe/matricule, sélecteur
// multi-enfants et compteurs (notes / absences / non lus).
export function EleveBar({ eleve, eleveNom, eleves, eleveId, setEleveActifId, mesNotes, mesAbsences, nonLus, c1, c2 }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${c1},${c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 900, flexShrink: 0 }}>
        {(eleveNom || "E")[0]}
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: "#0A1628" }}>{eleveNom || "Aucun eleve"}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {eleve.classe && <span style={{ background: "#e0ebf8", color: c1, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginRight: 8 }}>{eleve.classe}</span>}
          {eleve.matricule && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>#{eleve.matricule}</span>}
        </div>
        {eleves.length > 1 && (
          <div style={{ marginTop: 10, maxWidth: 280 }}>
            <select value={eleveId || ""} onChange={(event) => setEleveActifId(event.target.value)} style={{ width: "100%", border: "1.5px solid #dbe5f0", borderRadius: 8, padding: "7px 10px", fontSize: 12, background: "#fff" }}>
              {eleves.map((item) => (
                <option key={item._id} value={item._id}>
                  {`${item.prenom || ""} ${item.nom || ""}`.trim()} {item.classe ? `- ${item.classe}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center", padding: "8px 16px", background: "#f0fdf4", borderRadius: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: C.greenDk }}>{mesNotes.length}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Notes</div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 16px", background: "#fff1f2", borderRadius: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#b91c1c" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "absent").length}</div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Absences</div>
        </div>
        {nonLus > 0 && (
          <div style={{ textAlign: "center", padding: "8px 16px", background: "#fef3c7", borderRadius: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#d97706" }}>{nonLus}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Non lus</div>
          </div>
        )}
      </div>
    </div>
  );
}
