// Barre d'onglets de l'écran Paramètres, groupée par thème (École,
// Pédagogie, Présentation, Avancé) avec icônes et description de
// l'onglet actif. L'onglet « Zone dangereuse » est stylé en rouge.
export function ParametresTabs({ tabItems, tabParam, setTabParam }) {
  const groupes = [...new Set(tabItems.map((t) => t.groupe))];
  const actif = tabItems.find((t) => t.id === tabParam);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start",
        background: "var(--lc-surface-alt)", border: "1px solid var(--lc-border)",
        borderRadius: 14, padding: "12px 16px 14px",
      }}>
        {groupes.map((groupe) => (
          <div key={groupe}>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--lc-text-faint)",
              margin: "0 0 6px 4px",
            }}>{groupe}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tabItems.filter((t) => t.groupe === groupe).map((t) => {
                const sel = tabParam === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTabParam(t.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "7px 13px", borderRadius: 9, cursor: "pointer",
                      fontSize: 12.5, fontWeight: 700, transition: "all .15s",
                      border: sel
                        ? `1px solid ${t.danger ? "rgba(248,113,113,0.55)" : "var(--lc-border)"}`
                        : "1px solid transparent",
                      background: sel
                        ? (t.danger ? "rgba(239,68,68,0.12)" : "var(--lc-surface)")
                        : "transparent",
                      color: t.danger
                        ? "#dc2626"
                        : (sel ? "var(--lc-text-brand)" : "var(--lc-text-muted)"),
                      boxShadow: sel ? "var(--lc-shadow)" : "none",
                    }}
                  >
                    <span aria-hidden="true" style={{ fontSize: 13 }}>{t.icon}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {actif?.desc && (
        <p style={{
          margin: "10px 4px 0", fontSize: 12, lineHeight: 1.6,
          color: actif.danger ? "#dc2626" : "var(--lc-text-muted)",
        }}>
          {actif.icon} {actif.desc}
        </p>
      )}
    </div>
  );
}
