import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";

// Table des enseignements (cours, compositions, absences enseignants…).
export function EnseignementsTable({ enseignements, cEng, supEng, canEdit, setForm, setModal }) {
  if (cEng) return <Chargement/>;
  if (enseignements.length === 0) return <Vide icone="📚" msg="Aucun enseignement enregistré"/>;
  return (
    <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
      <THead cols={["Enseignant","Matière","Classe","Date","Heure","Type","Statut","Observation",canEdit?"Actions":""]}/>
      <tbody>{enseignements.sort((a,b)=>b.date>a.date?1:-1).map(e=><TR key={e._id}>
        <TD bold>{e.enseignantNom}</TD>
        <TD>{e.matiere}</TD>
        <TD><Badge color="blue">{e.classe}</Badge></TD>
        <TD>{e.date}</TD>
        <TD>{e.heure||"—"}</TD>
        <TD><Badge color="gray">{e.type}</Badge></TD>
        <TD><Badge color={
          e.statut==="Effectué"?"vert":
          e.statut==="Absent"?"red":
          e.statut==="Retard"?"amber":"purple"
        }>{e.statut}</Badge></TD>
        <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.observation||"—"}</span></TD>
        {canEdit&&<TD><div style={{display:"flex",gap:6}}>
          <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_eng");}}>Modifier</Btn>
          <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEng(e._id);}}>Suppr.</Btn>
        </div></TD>}
      </TR>)}</tbody>
    </table></div></Card>
  );
}
