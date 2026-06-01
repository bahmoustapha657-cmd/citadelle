import { ACCES, ADMIN_WRITABLE_MODULES, C, getModuleOptionsForRole, normalizeRoleLogin } from "../../../constants";
import { Badge } from "../../ui";
import { compteColor } from "../admin-helpers";

// Carte de configuration d'un rôle personnalisable : activation, label/nom/login
// et la grille des modules visibles (avec toggle écriture pour l'admin).
export function RoleConfigItem({ role, config, majRoleConfig, toggleModuleRole, toggleWriteModuleRole }) {
  const modulesOptions = getModuleOptionsForRole(role);
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge color={compteColor(role)}>{config.label || role}</Badge>
          <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>role: {role}</span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: config.active !== false ? C.greenDk : "#9ca3af", cursor: role === "direction" ? "default" : "pointer" }}>
          <input type="checkbox" checked={config.active !== false} disabled={role === "direction"} onChange={(event) => majRoleConfig(role, "active", event.target.checked)} />
          {role === "direction" ? "Toujours actif" : "Compte actif"}
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blueDark, marginBottom: 4 }}>Label affiché</label>
          <input value={config.label || ""} onChange={(event) => majRoleConfig(role, "label", event.target.value)} style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blueDark, marginBottom: 4 }}>Nom du compte</label>
          <input value={config.nom || ""} onChange={(event) => majRoleConfig(role, "nom", event.target.value)} style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blueDark, marginBottom: 4 }}>Identifiant</label>
          <input value={config.login || ""} onChange={(event) => majRoleConfig(role, "login", normalizeRoleLogin(event.target.value, role))} style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 12px", fontSize: 13, boxSizing: "border-box", fontFamily: "monospace" }} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: C.blueDark }}>
          Modules visibles
          {role === "admin" && <span style={{ marginLeft: 8, fontWeight: 500, color: "#64748b" }}>(cochez ✏️ pour autoriser l'écriture)</span>}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {modulesOptions.map((moduleOption) => {
            const isVisible = (config.modules || []).includes(moduleOption.id);
            const canWrite = role === "admin" && ADMIN_WRITABLE_MODULES.includes(moduleOption.id);
            const writeChecked = canWrite && (config.writeModules || []).includes(moduleOption.id);
            return (
              <div key={moduleOption.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, border: "1px solid #dbe4ee", background: "#fff", fontSize: 12, color: C.blueDark }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={isVisible} onChange={() => toggleModuleRole(role, moduleOption.id)} />
                  <span>{moduleOption.label}</span>
                </label>
                {canWrite && (
                  <label
                    title={isVisible ? "Autoriser l'écriture sur ce module" : "Activez d'abord le module pour autoriser l'écriture"}
                    style={{ display: "flex", alignItems: "center", gap: 3, paddingLeft: 6, borderLeft: "1px solid #e5e7eb", cursor: isVisible ? "pointer" : "not-allowed", opacity: isVisible ? 1 : 0.4 }}>
                    <input type="checkbox" disabled={!isVisible} checked={writeChecked} onChange={() => toggleWriteModuleRole(role, moduleOption.id)} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: writeChecked ? C.greenDk : "#94a3b8" }}>✏️</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {role === "admin" && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
            🔒 <strong>Modules système</strong> (toujours en lecture seule pour l'administrateur, même si cochés) : Comptabilité, Paramètres, Fondation, Gestion Accès, Historique. Garde-fou anti-auto-promotion et traçabilité.
          </p>
        )}
        {role !== "admin" && ACCES[role]?.includes("admin_panel") && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af" }}>Les accès sensibles indispensables sont conservés automatiquement pour ce rôle.</p>
        )}
      </div>
    </div>
  );
}
