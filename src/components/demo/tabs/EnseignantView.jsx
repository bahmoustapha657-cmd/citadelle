import { Badge, Card, THead, TR, TD } from "../../ui";

const LIGNES = [
  ["Aïssatou Diallo", "EDG-0118", 14],
  ["Mamadou Bah", "EDG-0119", 11.5],
  ["Ibrahima Condé", "EDG-0120", 16],
  ["Mariama Barry", "EDG-0121", 12],
  ["Kadiatou Sylla", "EDG-0122", 15.5],
  ["Mohamed Soumah", "EDG-0123", 17],
  ["Hadja Keita", "EDG-0124", null],
  ["Sékou Touré", "EDG-0125", 9],
];

// Démo onglet Portail enseignant : saisie de notes en grille.
export function EnseignantView() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--lc-text-brand, #0A1628)" }}>📊 Saisie en grille — Mathématiques · 4e B</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>
              L'enseignant saisit toute une classe en une fois, type d'évaluation au choix : Devoir, Interrogation, Évaluation orale, Évaluation écrite, Composition…
            </p>
          </div>
          <Badge color="vert">Évaluation écrite · T2</Badge>
        </div>
        <div style={{ border: "1px solid var(--lc-border, #e2e8f0)", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead cols={["#", "Élève", "Matricule", "Note /20"]} />
            <tbody>
              {LIGNES.map(([nom, mat, val], i) => (
                <TR key={mat}>
                  <TD center style={{ color: "var(--lc-text-faint, #94a3b8)" }}>{i + 1}</TD>
                  <TD bold>{nom}</TD>
                  <TD style={{ fontFamily: "monospace", fontSize: 11, color: "var(--lc-text-muted, #64748b)" }}>{mat}</TD>
                  <TD center>
                    <span style={{
                      display: "inline-block", width: 60, padding: "4px 8px",
                      border: `1.5px solid ${val == null ? "var(--lc-border, #e2e8f0)" : "#00C48C"}`,
                      borderRadius: 6, fontSize: 13, fontWeight: 700,
                      color: val == null ? "var(--lc-text-faint, #94a3b8)" : val >= 10 ? "#15803d" : "#b91c1c",
                      background: "var(--lc-input-bg, #fafbfc)",
                    }}>{val == null ? "—" : val}</span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, color: "#1e40af" }}>
          7 notes saisies sur 8 élèves — il reste 1 case vide. Cliquer sur 💾 Enregistrer enverra le tout en une seule opération.
        </div>
      </Card>
    </div>
  );
}
