// Carte chiffre « lisible » des écrans financiers : intitulé en clair (pas de
// petites capitales grisées), montant en gros, explication sous le chiffre.
// La couleur passe par un liseré plutôt qu'un fond pastel, pour rester
// lisible en thème sombre.
export function StatClair({ label, value, sub, couleur = "var(--lc-border)", valeurCouleur = "var(--lc-text)" }) {
  return (
    <div style={{ textAlign: "start", background: "var(--lc-surface)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--lc-border)", borderInlineStart: `5px solid ${couleur}`, boxShadow: "var(--lc-shadow)" }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: "var(--lc-text)", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: valeurCouleur, margin: "0 0 2px", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--lc-text-muted)", margin: 0, lineHeight: 1.4 }}>{sub}</p>}
    </div>
  );
}
