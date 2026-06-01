import { C } from "../../../constants";
import { Badge, Btn, Card, Chargement, Vide } from "../../ui";
import { getTeacherMonthlyForfait } from "../../../teacher-utils";

// Grille de cartes enseignant : identité, forfait/matière, fichiers et
// actions (modifier, créer compte, supprimer).
export function EnsListe({
  ens, cEns, couleur, isPrimarySection, canEdit, supEns,
  setForm, setModal, ouvrirCompteEns, t,
}) {
  if (cEns) return <Chargement/>;
  if (ens.length === 0) return <Vide icone="👨‍🏫" msg={t("school.teachers.noTeacher")}/>;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
      {ens.map(e=><Card key={e._id}><div style={{padding:"14px 15px"}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
          <div style={{width:38,height:38,borderRadius:8,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"#fff"}}>
            {(e.prenom||"?")[0]}{(e.nom||"?")[0]}
          </div>
          <Badge color={e.statut==="Titulaire"?"vert":"amber"}>{e.statut}</Badge>
        </div>
        <p style={{margin:"0 0 1px",fontWeight:800,fontSize:13,color:C.blueDark}}>{e.prenom} {e.nom}</p>
        <p style={{margin:"0 0 4px",fontSize:12,color:couleur,fontWeight:700}}>
          {isPrimarySection
            ? `Forfait ${Number(getTeacherMonthlyForfait(e) || 0).toLocaleString("fr-FR")} GNF`
            : e.matiere}
        </p>
        <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{e.grade} · {e.telephone}</p>
        {(e.fichiers||[]).length>0&&<div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
          {e.fichiers.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:C.blue,background:"#e0ebf8",padding:"2px 5px",borderRadius:3}}>📎 {f.nom}</a>)}
        </div>}
        {canEdit&&<div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens");}}>✏️ Modifier</Btn>
          <Btn sm v="purple" onClick={()=>ouvrirCompteEns(e)}>🔑 Compte</Btn>
          <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEns(e._id);}}>🗑</Btn>
        </div>}
      </div></Card>)}
    </div>
  );
}
