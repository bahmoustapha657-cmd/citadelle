import { C, genererMatricule } from "../../../constants";
import { Btn } from "../../ui";

// Barre d'outils de l'enrôlement : titre + compteur de plan, sélecteur de
// niveau, bascule Départs et boutons d'ajout (normal/rapide/import Excel).
export function EnrolToolbar({
  t, afficherDeparts, setAfficherDeparts, planInfo,
  niveauEnrol, setNiveauEnrol, elevesC, elevesL, elevesP,
  canCreate, elevesEnrol, schoolInfo, setForm, setModal,
}) {
  return (
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
  );
}
