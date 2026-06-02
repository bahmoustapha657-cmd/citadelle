import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";

// Table des matières (coefficient + classes concernées + actions).
export function MatieresTable({ matieres, cMat, supMat, canEdit, setForm, setModal, noSubjectMsg }) {
  if (cMat) return <Chargement/>;
  if (matieres.length === 0) return <Vide icone="📚" msg={noSubjectMsg}/>;
  return (
    <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
      <THead cols={["Matière","Coefficient","Classes concernées",canEdit?"Actions":""]}/>
      <tbody>{matieres.map(m=><TR key={m._id}>
        <TD bold>{m.nom}</TD>
        <TD><Badge color="blue">Coef. {m.coefficient}</Badge></TD>
        <TD>
          {!m.classes||!m.classes.length
            ? <span style={{color:"#9ca3af",fontSize:11,fontStyle:"italic"}}>Toutes les classes</span>
            : <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {m.classes.map(c=><span key={c} style={{background:"#ede9fe",color:"#6d28d9",padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700}}>{c}</span>)}
              </div>}
        </TD>
        {canEdit&&<TD><div style={{display:"flex",gap:6}}>
          <Btn sm v="ghost" onClick={()=>{setForm({...m,classesEdit:[...(m.classes||[])]});setModal("edit_mat_"+m._id);}}>Modifier</Btn>
          <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supMat(m._id);}}>Suppr.</Btn>
        </div></TD>}
      </TR>)}</tbody>
    </table></div></Card>
  );
}
