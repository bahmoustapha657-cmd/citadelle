import { Card, THead } from "../../ui";

// Carte tableau réutilisable pour les vues de démonstration.
export function TableCard({ title, subtitle, header, rows }) {
  return (
    <Card style={{ overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 10px" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--lc-text-brand, #0A1628)" }}>{title}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>{subtitle}</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
          <THead cols={header} />
          <tbody>{rows}</tbody>
        </table>
      </div>
    </Card>
  );
}
