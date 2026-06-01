import { C, PLANS } from "../../../constants";
import { inp, lab } from "./composer-styles";

// Ciblage des écoles : toutes, par plan ou sélection manuelle.
export function CibleEcoles({ modeCible, setModeCible, planChoisi, setPlanChoisi, schoolsChoisies, ecoles, ecolesParPlan, toggleSchool }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lab}>Cibler les écoles</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {[
          { id: "toutes", label: "Toutes" },
          { id: "plan", label: "Par plan" },
          { id: "selection", label: "Sélection" },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModeCible(m.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              border: `2px solid ${modeCible === m.id ? C.blue : "#e5e7eb"}`,
              background: modeCible === m.id ? "#e0f2fe" : "#fff",
              color: modeCible === m.id ? C.blue : "#6b7280",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {modeCible === "plan" && (
        <select value={planChoisi} onChange={(e) => setPlanChoisi(e.target.value)} style={inp}>
          {Object.entries(PLANS).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label} — {ecolesParPlan[key] || 0} école(s)
            </option>
          ))}
        </select>
      )}

      {modeCible === "selection" && (
        <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
          {ecoles.length === 0 ? (
            <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>Aucune école.</div>
          ) : (
            ecoles.map((e) => (
              <label key={e._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={schoolsChoisies.includes(e._id)}
                  onChange={() => toggleSchool(e._id)}
                />
                <span style={{ flex: 1 }}>{e.nom}</span>
                <code style={{ fontSize: 11, color: "#9ca3af" }}>{e._id}</code>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
