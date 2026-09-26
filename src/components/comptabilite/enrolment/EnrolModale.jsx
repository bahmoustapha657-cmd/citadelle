import { Btn, Modale } from "../../ui";
import { EnrolFormChamps } from "./EnrolFormChamps";
import { PhotoEleveChamp } from "./PhotoEleveChamp";
import { useEnrolPhoto } from "./use-enrol-photo";

export function EnrolModale({
  modal, setModal, form, setForm, chg, niveauEnrol,
  schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
}) {
  const { uploadEnCours, enregistrer } = useEnrolPhoto({
    modal, setModal, form, niveauEnrol,
    schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
  });

  return (<Modale large titre={modal==="add_enrol"?"Nouvel élève":"Modifier l'élève"} fermer={()=>setModal(null)}>
    <EnrolFormChamps form={form} chg={chg} niveauEnrol={niveauEnrol}/>
    <div style={{marginTop:14,borderTop:"1px solid #e5e7eb",paddingTop:14}}>
      <PhotoEleveChamp photo={form.photo} onChange={photo=>setForm(p=>({...p,photo}))} toast={toast}/>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={uploadEnCours}>Annuler</Btn>
      <Btn disabled={uploadEnCours} onClick={enregistrer}>{uploadEnCours?"⏳ Upload photo...":"Enregistrer"}</Btn>
    </div>
  </Modale>);
}
