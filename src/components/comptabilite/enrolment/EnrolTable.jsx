import { useTranslation } from "react-i18next";
import { C, aReinscrire, genererMatricule } from "../../../constants";
import { libelleStatutEleve } from "../../../i18n/libelles";
import { Badge, Btn, THead, TR, TD, Vide, Chargement } from "../../ui";
import { nomAffiche } from "../../../ordre-eleves";

// Tableau des élèves enrôlés pour le niveau courant, avec actions :
// modifier, dupliquer (fratrie), déclarer un départ, supprimer (refusé à une
// fiche qui porte de l'argent : cf. EnrolmentTab / suppression-eleve.js).
export function EnrolTable({
  cEC, cEL, cEP, elevesEnrol, canEdit, canCreate, planInfo,
  niveauEnrol, schoolInfo, setForm, setModal, declarerDepart, supprimerEleve,
}) {
  const { t } = useTranslation();
  if (cEC || cEL || cEP) return <Chargement/>;
  if (elevesEnrol.length === 0) return <Vide icone="🎓" msg={t("accounting.enrol.noStudent")}/>;
  const cols = ["matricule", "ien", "name", "class", "sex", "filiation", "guardian", "contact", "address", "status", "actions"];
  return (
    <div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:900}}>
        <THead cols={cols.map((c) => t(`accounting.cols.${c}`))}/>
        <tbody>{elevesEnrol.map(e=><TR key={e._id}>
          <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
          <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
          <TD bold>{nomAffiche(e, schoolInfo?.triEleves)}</TD><TD>{e.classe}</TD>
          <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
          <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
          <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
          <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
          <TD>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              <Badge color={e.statut==="Actif"?"vert":"gray"}>{libelleStatutEleve(e.statut)}</Badge>
              {/* « À réinscrire » = inscription pas encore encaissée pour
                  l'année en cours. L'élève compte toujours dans l'effectif de
                  sa classe : la pastille signale un dossier à finir, pas une
                  absence. */}
              {aReinscrire(e)&&<Badge color="amber" title={t("accounting.enrol.toReenrolHint")}>{t("accounting.enrol.toReenrol")}</Badge>}
            </div>
          </TD>
          {canEdit&&<TD><div style={{display:"flex",gap:6}}>
            <Btn sm v="ghost" onClick={()=>{setForm({...e,niveau:niveauEnrol});setModal("edit_enrol");}}>{t("common.edit")}</Btn>
            {canCreate&&planInfo?.peutAjouterEleve&&<Btn sm v="ghost" title={t("accounting.enrol.duplicateHint")} onClick={()=>{
              const mat=genererMatricule(elevesEnrol,niveauEnrol,schoolInfo);
              // i18n-ignore
              setForm({statut:"Actif",sexe:e.sexe||"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription",
                classe:e.classe,filiation:e.filiation,tuteur:e.tuteur,contactTuteur:e.contactTuteur,domicile:e.domicile});
              setModal("add_enrol");
            }}>👥</Btn>}
            {e.statut==="Actif"&&<Btn sm v="amber" onClick={()=>declarerDepart(e)} title={t("accounting.enrol.declareDeparture")}>📤</Btn>}
            <Btn sm v="danger" onClick={()=>supprimerEleve(e)}>{t("accounting.enrol.deleteShort")}</Btn>
          </div></TD>}
        </TR>)}</tbody>
      </table>
    </div>
  );
}
