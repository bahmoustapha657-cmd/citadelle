import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";

// Table des événements de discipline / absences.
export function DisciplineTable({ absences, cAbs, supAbs, canEdit }) {
  if (cAbs) return <Chargement/>;
  if (absences.length === 0) return <Vide icone="📋" msg="Aucun événement de discipline enregistré"/>;
  return (
    <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
      <THead cols={["Élève","Classe","Type","Date","Motif","Justifié",canEdit?"Action":""]}/>
      <tbody>{absences.map(a=><TR key={a._id}>
        <TD bold>{a.eleveNom}</TD><TD>{a.classe}</TD>
        <TD><Badge color={a.type==="Absence"?"red":a.type==="Retard"?"amber":"orange"}>{a.type}</Badge></TD>
        <TD>{a.date}</TD><TD>{a.motif||"—"}</TD>
        <TD><Badge color={a.justifie==="Oui"?"vert":"red"}>{a.justifie}</Badge></TD>
        {canEdit&&<TD><Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supAbs(a._id);}}>Suppr.</Btn></TD>}
      </TR>)}</tbody>
    </table></div></Card>
  );
}
