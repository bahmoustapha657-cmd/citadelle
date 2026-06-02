// Bloc de section titrée avec grille deux colonnes.
export function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#0A1628", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, paddingBottom: 4, borderBottom: "1.5px solid #e2e8f0" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
    </div>
  );
}
