import { Badge, Btn, Card, TD, THead, TR } from "../ui";
import { getEvaluationLabel } from "../../evaluation-forms";

// Tableau des examens passés (lecture seule atténuée) avec réimpression des
// convocations et suppression.
export function ExamensPasses({ passes, schoolInfo, genererConvocations, supEx }) {
  return (
    <>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "#94a3b8", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Passés ({passes.length})</h3>
      <Card style={{ opacity: 0.75 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <THead cols={["Titre", "Type", "Classe", "Date", "Salle", "Actions"]} />
          <tbody>{passes.map(ex => <TR key={ex._id}>
            <TD bold>{ex.titre}</TD>
            <TD><Badge color="gray">{getEvaluationLabel(ex.type, schoolInfo, { kind: "exam" })}</Badge></TD>
            <TD>{ex.classe || "Toutes"}</TD>
            <TD>{ex.date}</TD>
            <TD>{ex.salle || "—"}</TD>
            <TD>
              <Btn sm v="ghost" onClick={() => genererConvocations(ex)}>🖨️</Btn>
              <Btn sm v="danger" style={{ marginLeft: 4 }} onClick={() => { if (confirm("Supprimer ?")) supEx(ex._id); }}>🗑️</Btn>
            </TD>
          </TR>)}</tbody>
        </table>
      </Card>
    </>
  );
}
