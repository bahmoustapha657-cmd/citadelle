import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../../ui";
import { imprimerListeClasse } from "../../../reports";

// Table des classes (effectif, titulaire, salle, impression, actions).
export function ClassesTable({ classes, cC, eleves, schoolInfo, effectifReel, supC, canEdit, setForm, setModal, noClassMsg }) {
  if (cC) return <Chargement/>;
  if (classes.length === 0) return <Vide icone="🏫" msg={noClassMsg}/>;
  return (
    <Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
      <THead cols={["Classe","Effectif","Enseignant Principal","Salle","Imprimer liste",canEdit?"Actions":""]}/>
      <tbody>{classes.map(c=><TR key={c._id}>
        <TD bold>{c.nom}</TD><TD><Badge color="blue">{effectifReel(c.nom)} élèves</Badge></TD>
        <TD>{c.enseignant}</TD><TD>{c.salle}</TD>
        <TD><Btn sm v="ghost" onClick={()=>imprimerListeClasse(c.nom,eleves,schoolInfo)}>🖨️ Imprimer</Btn></TD>
        {canEdit&&<TD><div style={{display:"flex",gap:6}}>
          <Btn sm v="ghost" onClick={()=>{setForm({...c});setModal("edit_c");}}>Modifier</Btn>
          <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supC(c._id);}}>Suppr.</Btn>
        </div></TD>}
      </TR>)}</tbody>
    </table></div></Card>
  );
}
