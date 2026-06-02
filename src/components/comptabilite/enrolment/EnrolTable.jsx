import { C, genererMatricule } from "../../../constants";
import { Badge, Btn, THead, TR, TD, Vide, Chargement } from "../../ui";

// Tableau des élèves enrôlés pour le niveau courant, avec actions :
// modifier, dupliquer (fratrie), déclarer un départ, supprimer.
export function EnrolTable({
  cEC, cEL, cEP, elevesEnrol, canEdit, canCreate, planInfo,
  niveauEnrol, schoolInfo, setForm, setModal, supEnrol,
}) {
  if (cEC || cEL || cEP) return <Chargement/>;
  if (elevesEnrol.length === 0) return <Vide icone="🎓" msg="Aucun élève enregistré"/>;
  return (
    <div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:900}}>
        <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Filiation","Tuteur","Contact","Domicile","Statut","Actions"]}/>
        <tbody>{elevesEnrol.map(e=><TR key={e._id}>
          <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
          <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
          <TD bold>{e.nom} {e.prenom}</TD><TD>{e.classe}</TD>
          <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
          <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
          <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
          <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
          <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut}</Badge></TD>
          {canEdit&&<TD><div style={{display:"flex",gap:6}}>
            <Btn sm v="ghost" onClick={()=>{setForm({...e,niveau:niveauEnrol});setModal("edit_enrol");}}>Modifier</Btn>
            {canCreate&&planInfo?.peutAjouterEleve&&<Btn sm v="ghost" title="Dupliquer — même tuteur/contact (frère/sœur)" onClick={()=>{
              const mat=genererMatricule(elevesEnrol,niveauEnrol,schoolInfo);
              setForm({statut:"Actif",sexe:e.sexe||"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription",
                classe:e.classe,filiation:e.filiation,tuteur:e.tuteur,contactTuteur:e.contactTuteur,domicile:e.domicile});
              setModal("add_enrol");
            }}>👥</Btn>}
            {e.statut==="Actif"&&<Btn sm v="amber" onClick={()=>{
              setForm({...e,niveau:niveauEnrol,statut:"Transféré",dateDepart:new Date().toISOString().slice(0,10)});
              setModal("edit_enrol");
            }} title="Déclarer un départ">📤</Btn>}
            <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer définitivement cet élève ?"))supEnrol(e._id);}}>Suppr.</Btn>
          </div></TD>}
        </TR>)}</tbody>
      </table>
    </div>
  );
}
