import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, genererMatricule } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { Badge, Btn, THead, TR, TD, Vide, Chargement } from "../ui";
import { DepartsView } from "./enrolment/DepartsView";
import { EnrolModale } from "./enrolment/EnrolModale";
import { RapideEnrolModale } from "./enrolment/RapideEnrolModale";
import { ImportEnrolModale } from "./enrolment/ImportEnrolModale";

export function EnrolmentTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  elevesC,
  elevesL,
  elevesP,
  cEC,
  cEL,
  cEP,
  tousElevesScolarite,
  ajoutParNiveau,
  suppressionParNiveau,
  modifParNiveau,
  ensureClasse,
  sortAlpha,
}) {
  const { t } = useTranslation();
  const { schoolId, schoolInfo, toast, planInfo } = useContext(SchoolContext);

  const [niveauEnrol, setNiveauEnrol] = useState("college");
  const [afficherDeparts, setAfficherDeparts] = useState(false);

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP };
  const elevesEnrol = sortAlpha(elevesParNiveau[niveauEnrol] || []);
  const ajEnrol = ajoutParNiveau[niveauEnrol] || ajoutParNiveau.college;
  const supEnrol = suppressionParNiveau[niveauEnrol] || suppressionParNiveau.college;
  const modEnrol = modifParNiveau[niveauEnrol] || modifParNiveau.college;

  return (
    <div>
      {/* ── Alerte plan : limite atteinte ── */}
      {planInfo && !planInfo.peutAjouterEleve && (
        <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",gap:14,alignItems:"center"}}>
          <span style={{fontSize:28}}>🔒</span>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontWeight:900,fontSize:14,color:"#92400e"}}>
              Limite d'élèves atteinte — Plan {planInfo.planLabel}
            </p>
            <p style={{margin:0,fontSize:12,color:"#78350f"}}>
              Vous avez <strong>{planInfo.totalElevesActifs}</strong> élèves actifs
              sur <strong>{planInfo.eleveLimit === Infinity ? "∞" : planInfo.eleveLimit}</strong> autorisés.
              {planInfo.planCourant==="gratuit"
                ? " Contactez le Super-Admin pour activer un abonnement et inscrire plus d'élèves."
                : " Contactez le Super-Admin pour passer à un plan supérieur."}
            </p>
          </div>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,flex:1,color:C.blueDark}}>
          {afficherDeparts?"📤 Départs & Statistiques":t("school.students.title")}
          {!afficherDeparts&&<span style={{marginLeft:10,fontSize:11,fontWeight:600,color:
            planInfo?.peutAjouterEleve?"#16a34a":"#dc2626"}}>
            ({planInfo?.totalElevesActifs ?? "…"}/{planInfo?.eleveLimit===Infinity?"∞":planInfo?.eleveLimit} élèves — Plan {planInfo?.planLabel})
          </span>}
        </strong>
        <select value={niveauEnrol} onChange={e=>setNiveauEnrol(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="college">Collège ({elevesC.length} élèves)</option>
          <option value="lycee">Lycée ({elevesL.length} élèves)</option>
          <option value="primaire">Primaire ({elevesP.length} élèves)</option>
        </select>
        <Btn sm v={afficherDeparts?"blue":"ghost"} onClick={()=>setAfficherDeparts(d=>!d)}>
          {afficherDeparts?"👥 Élèves actifs":"📤 Départs"}
        </Btn>
        {!afficherDeparts&&canCreate&&(
          planInfo?.peutAjouterEleve
            ? <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <Btn onClick={()=>{
                  const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                  setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                  setModal("add_enrol");
                }}>+ Nouvel élève</Btn>
                <Btn v="ghost" title="Saisie rapide : formulaire minimal, enchaîner plusieurs élèves" onClick={()=>{
                  const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                  setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                  setModal("rapide_enrol");
                }}>⚡ Rapide</Btn>
                <Btn v="ghost" title="Importer depuis un fichier Excel ou CSV" onClick={()=>{setModal("import_enrol");}}>📋 Import Excel</Btn>
              </div>
            : <Btn disabled title="Limite du plan atteinte — Contactez le Super-Admin">🔒 Limite atteinte</Btn>
        )}
      </div>
      <div style={{background:"#e0ebf8",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:C.blueDark}}>
        🔒 Seul le <strong>Comptable</strong> peut enrôler ou supprimer des élèves.
      </div>
      {!afficherDeparts&&(
        (cEC||cEL||cEP)?<Chargement/>:elevesEnrol.length===0?<Vide icone="🎓" msg="Aucun élève enregistré"/>
        :<div className="lc-sticky-wrap">
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
      )}
      {afficherDeparts&&<DepartsView elevesEnrol={elevesEnrol} canEdit={canEdit} modEnrol={modEnrol} toast={toast}/>}

      {((modal==="add_enrol"&&canCreate)||(modal==="edit_enrol"&&canEdit))&&<EnrolModale
        modal={modal} setModal={setModal} form={form} setForm={setForm} chg={chg} niveauEnrol={niveauEnrol}
        schoolId={schoolId} toast={toast} tousElevesScolarite={tousElevesScolarite}
        ajEnrol={ajEnrol} modEnrol={modEnrol} ensureClasse={ensureClasse}/>}

      {modal==="rapide_enrol"&&canCreate&&<RapideEnrolModale
        setModal={setModal} form={form} setForm={setForm} chg={chg} niveauEnrol={niveauEnrol}
        schoolInfo={schoolInfo} toast={toast} tousElevesScolarite={tousElevesScolarite}
        ajEnrol={ajEnrol} ensureClasse={ensureClasse} elevesEnrol={elevesEnrol}/>}

      {modal==="import_enrol"&&canCreate&&<ImportEnrolModale
        setModal={setModal} niveauEnrol={niveauEnrol} schoolInfo={schoolInfo} toast={toast}
        tousElevesScolarite={tousElevesScolarite} ajoutParNiveau={ajoutParNiveau}
        ensureClasse={ensureClasse} elevesEnrol={elevesEnrol}/>}
    </div>
  );
}
