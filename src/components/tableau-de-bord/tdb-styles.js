// Styles partagés du tableau de bord : une seule échelle d'espacements et de
// typographie pour tous les blocs, et des couleurs tirées du thème (--lc-*)
// pour que le mode sombre suive sans les correctifs « catch-all » d'index.css.

export const ESPACE = 16;

export const titreCarte = {
  margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "var(--lc-text-brand)", letterSpacing: "0.01em",
};

export const sousTitre = {
  margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "var(--lc-text-muted)",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

export const corpsCarte = { padding: "18px 20px" };

// Grille qui passe en une colonne sur téléphone.
export const grilleSouple = (min) => ({
  display: "grid", gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))`, gap: ESPACE,
});

// Recharts pose ces valeurs en attributs SVG, où var() n'est pas fiable :
// des gris neutres lisibles sur fond clair comme sombre.
export const axe = { fontSize: 11, fill: "#94a3b8" };
export const grille = "rgba(148,163,184,0.18)";
export const infobulle = {
  contentStyle: { borderRadius: 10, border: "1px solid var(--lc-border)", background: "var(--lc-surface)", color: "var(--lc-text)", fontSize: 12, boxShadow: "var(--lc-shadow)" },
  cursor: { fill: "rgba(148,163,184,0.08)" },
};

// Encadré d'alerte : fond teinté léger, pastille de couleur, texte du thème.
export const TONS = {
  ok: "#10b981", attention: "#f59e0b", danger: "#ef4444", info: "#6366f1",
};
export const encadre = (ton) => ({
  display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10,
  background: `${ton}14`, fontSize: 12, lineHeight: 1.45, color: "var(--lc-text)",
});
export const pastille = (ton) => ({
  width: 8, height: 8, borderRadius: "50%", background: ton, flexShrink: 0, marginTop: 5,
});
