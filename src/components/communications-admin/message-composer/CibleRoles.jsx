import { C } from "../../../constants";
import { ROLES_CIBLABLES } from "../communications-constants";
import { lab } from "./composer-styles";

// Ciblage des rôles destinataires (le rôle parent est toujours exclu).
export function CibleRoles({ rolesChoisis, toggleRole }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={lab}>Cibler les rôles (parent toujours exclu)</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {ROLES_CIBLABLES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => toggleRole(r.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `2px solid ${rolesChoisis.includes(r.id) ? C.green : "#e5e7eb"}`,
              background: rolesChoisis.includes(r.id) ? "#d1fae5" : "#fff",
              color: rolesChoisis.includes(r.id) ? "#065f46" : "#6b7280",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {rolesChoisis.includes(r.id) ? "✓ " : ""}
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
