import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";
import { getEvaluationLabel } from "../../../evaluation-forms";

// Vue liste des notes (tableau classique avec action suppression).
export function NotesListe({ cN, notes, maxNote, readOnly, schoolInfo, isPrimarySection, canEdit, supN }) {
  if (cN) return <Chargement />;
  if (notes.length === 0) return <Vide icone="📝" msg="Aucune note" />;

  return (
    <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
      <THead cols={["Élève", "Matière", "Type", "Période", `Note /${maxNote}`, readOnly ? "" : "Action"]} />
      <tbody>{notes.map(n => <TR key={n._id}>
        <TD bold>{n.eleveNom}</TD><TD>{n.matiere}</TD>
        <TD><Badge color="gray">{getEvaluationLabel(n.type, schoolInfo, { section: isPrimarySection ? "primaire" : "secondaire" })}</Badge></TD><TD>{n.periode}</TD>
        <TD><Badge color={n.note >= (maxNote * 0.7) ? "vert" : n.note >= (maxNote * 0.5) ? "blue" : "red"}>{n.note}/{maxNote}</Badge></TD>
        {canEdit && <TD><Btn sm v="danger" onClick={() => { if (confirm("Supprimer ?")) supN(n._id); }}>Suppr.</Btn></TD>}
      </TR>)}</tbody>
    </table></div></Card>
  );
}
