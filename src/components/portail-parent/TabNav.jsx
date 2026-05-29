// Barre d'onglets du portail parent (signale les onglets bloqués par impayé).
export function TabNav({ tabs, tab, setTab, c1 }) {
  return (
    <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
      {tabs.map((item) => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          style={{
            padding: "13px 16px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            color: tab === item.id ? c1 : item.bloque ? "#ef4444" : "#64748b",
            borderBottom: tab === item.id ? `3px solid ${c1}` : "3px solid transparent",
            opacity: item.bloque && tab !== item.id ? 0.75 : 1,
          }}
        >
          {item.bloque ? "Bloque - " : ""}
          {item.label}
        </button>
      ))}
    </div>
  );
}
