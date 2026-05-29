// Ligne label/valeur en lecture seule pour l'affichage du widget conformité.
export function ReadRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "3px 0", fontSize: 11, lineHeight: 1.5 }}>
      <span style={{ color: "#64748b", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#0A1628", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>
        {value || <span style={{ color: "#cbd5e1", fontWeight: 400 }}>—</span>}
      </span>
    </div>
  );
}
