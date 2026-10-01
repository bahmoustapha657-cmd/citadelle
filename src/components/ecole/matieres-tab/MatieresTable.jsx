import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";
import { NATURES_MATIERE, estEvaluee, natureMatiere } from "../../../matiere-nature";

const COULEUR_NATURE = { matiere: "blue", rubrique: "amber", epreuve: "green" };

// Table des matières (nature + coefficient + classes concernées + actions).
export function MatieresTable({ matieres, cMat, supMat, canEdit, setForm, setModal, noSubjectMsg }) {
  if (cMat) return <Chargement/>;
  if (matieres.length === 0) return <Vide icone="📚" msg={noSubjectMsg}/>;
  return (
    <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
      <THead cols={["Matière","Nature","Coefficient","Classes concernées",canEdit?"Actions":""]}/>
      <tbody>{matieres.map(m=>{
        const nature = NATURES_MATIERE.find(n=>n.v===natureMatiere(m));
        return <TR key={m._id}>
        <TD bold>
          {m.nom}
          {m.rattachement&&<div style={{fontSize:11,fontWeight:400,color:"#6b7280"}}>↳ {m.rattachement}</div>}
        </TD>
        <TD><Badge color={COULEUR_NATURE[nature.v]}>{nature.icone} {nature.label}</Badge></TD>
        <TD>{estEvaluee(m)
          ? <Badge color="blue">Coef. {m.coefficient}</Badge>
          : <span style={{color:"#9ca3af",fontSize:11,fontStyle:"italic"}}>Non évaluée</span>}</TD>
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
      </TR>;
      })}</tbody>
    </table></div></Card>
  );
}
