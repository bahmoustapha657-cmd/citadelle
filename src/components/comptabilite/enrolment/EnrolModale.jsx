import { C } from "../../../constants";
import { Btn, Modale } from "../../ui";
import { CameraCapture } from "../../CameraCapture";
import { EnrolFormChamps } from "./EnrolFormChamps";
import { useEnrolPhoto } from "./use-enrol-photo";

export function EnrolModale({
  modal, setModal, form, setForm, chg, niveauEnrol,
  schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
}) {
  const { cameraOuverte, setCameraOuverte, uploadEnCours, handlePhotoFichier, enregistrer } = useEnrolPhoto({
    modal, setModal, form, setForm, niveauEnrol,
    schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
  });

  return (<Modale large titre={modal==="add_enrol"?"Nouvel élève":"Modifier l'élève"} fermer={()=>setModal(null)}>
    <EnrolFormChamps form={form} chg={chg} niveauEnrol={niveauEnrol}/>
    {/* Photo de l'élève */}
    <div style={{marginTop:14,borderTop:"1px solid #e5e7eb",paddingTop:14}}>
      <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 10px",letterSpacing:"0.07em"}}>📷 Photo de l'élève (optionnel)</p>
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",border:`2px solid ${C.blue}`,background:"#f0f4f8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {form.photo
            ? <img src={form.photo} alt="photo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : <span style={{fontSize:32}}>👤</span>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="blue" onClick={()=>setCameraOuverte(true)}>📸 Prendre une photo</Btn>
          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.blue}`,background:"#fff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            📁 Importer depuis la galerie
            <input type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoFichier}/>
          </label>
          {form.photo&&<Btn sm v="danger" onClick={()=>setForm(p=>({...p,photo:""}))}>✕ Supprimer</Btn>}
        </div>
      </div>
    </div>
    {cameraOuverte&&<CameraCapture onCapture={photo=>{setForm(p=>({...p,photo}));setCameraOuverte(false);}} onClose={()=>setCameraOuverte(false)}/>}
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={uploadEnCours}>Annuler</Btn>
      <Btn disabled={uploadEnCours} onClick={enregistrer}>{uploadEnCours?"⏳ Upload photo...":"Enregistrer"}</Btn>
    </div>
  </Modale>);
}
