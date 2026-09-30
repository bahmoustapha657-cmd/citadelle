// Styles partagés de la messagerie (variables de thème : clair / sombre).
export const champ = {
  width: "100%", boxSizing: "border-box", padding: "8px 11px", borderRadius: 9,
  border: "1.5px solid var(--lc-border)", background: "var(--lc-input-bg)", color: "var(--lc-text)",
  fontSize: 13, outline: "none",
};

export const puce = (actif) => ({
  padding: "5px 11px", borderRadius: 14, fontSize: 12, fontWeight: 700, cursor: "pointer",
  border: actif ? "1.5px solid var(--sc1)" : "1px solid var(--lc-border)",
  background: actif ? "var(--sc1-lt)" : "var(--lc-surface)",
  color: actif ? "var(--sc1)" : "var(--lc-text-muted)",
  whiteSpace: "nowrap",
});

export const boutonIcone = {
  background: "transparent", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1,
  padding: 7, borderRadius: 8, color: "var(--lc-text-muted)",
};

export const badge = {
  background: "#ef4444", color: "#fff", borderRadius: 10, fontSize: 10, fontWeight: 800,
  padding: "1px 6px", minWidth: 18, textAlign: "center", lineHeight: "16px",
};

export const texteDiscret = { fontSize: 11, color: "var(--lc-text-faint)" };
