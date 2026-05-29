import { Btn, Card, TR, TD } from "../../ui";
import { notes } from "../demo-data";
import { TableCard } from "./TableCard";

// Démo onglet Notes : bandeau bulletin + synthèse des moyennes par matière.
export function NotesView({ onApercuBulletin }) {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={{ padding: 18, background: "linear-gradient(135deg,#0A1628,#14335f)", color: "#fff", border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#fff" }}>Bulletins du 2e trimestre — Terminale A</h3>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>22 élèves, moyenne classe 13,42 / 20</p>
          </div>
          <Btn v="vert" onClick={onApercuBulletin}>📄 Aperçu d'un bulletin</Btn>
        </div>
      </Card>
      <TableCard
        title="Synthèse des moyennes par matière (extraits)"
        subtitle="Au secondaire, EduGest applique la formule (moy. cours + 2 × composition) / 3, avec coefficients par matière."
        header={["Élève", "Matière", "Moyenne", "Rang"]}
        rows={notes.map((item) => (
          <TR key={`${item.eleve}-${item.matiere}`}>
            <TD bold>{item.eleve}</TD>
            <TD>{item.matiere}</TD>
            <TD><strong style={{ color: item.moyenne >= 10 ? "#15803d" : "#b91c1c" }}>{item.moyenne.toFixed(2)} / 20</strong></TD>
            <TD>{item.rang}<span style={{ color: "var(--lc-text-faint, #94a3b8)", fontSize: 11 }}>/{item.effectif}</span></TD>
          </TR>
        ))}
      />
    </div>
  );
}
