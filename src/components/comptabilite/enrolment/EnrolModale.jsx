import React, { useState } from "react";
import { C, initMens, getClassesForSection } from "../../../constants";
import { uploadPhotoEleve } from "../../../storageUtils";
import { Btn, Champ, Input, Modale, Selec } from "../../ui";
import { CameraCapture } from "../../CameraCapture";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";

export function EnrolModale({
  modal, setModal, form, setForm, chg, niveauEnrol,
  schoolId, toast, tousElevesScolarite, ajEnrol, modEnrol, ensureClasse,
}) {
  const [cameraOuverte, setCameraOuverte] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);

  const handlePhotoFichier = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("Image trop grande (max 2 Mo).", "warning"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((p) => ({ ...p, photo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (<Modale large titre={modal==="add_enrol"?"Nouvel élève":"Modifier l'élève"} fermer={()=>setModal(null)}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
      <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
      <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
      <Champ label="Matricule (auto-généré)">
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input value={form.matricule||""} onChange={chg("matricule")}
            style={{flex:1,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
          <span style={{fontSize:10,color:"#9ca3af",whiteSpace:"nowrap"}}>Modifiable si besoin</span>
        </div>
      </Champ>
      <Champ label="Identifiant National (IEN)">
        <div style={{position:"relative"}}>
          <input value={form.ien||""} onChange={chg("ien")}
            placeholder="Ex : GN-2024-000123"
            style={{width:"100%",border:"1.5px solid #c7d2fe",borderRadius:8,padding:"7px 10px 7px 30px",fontSize:13,boxSizing:"border-box",outline:"none",background:"#eef2ff",fontFamily:"monospace",fontWeight:700,color:"#3730a3"}}/>
          <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🪪</span>
        </div>
      </Champ>
      <Champ label="Classe">
        <select value={form.classe||""} onChange={chg("classe")}
          style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
          <option value="">— Sélectionner —</option>
          {getClassesForSection(niveauEnrol).map(c=><option key={c}>{c}</option>)}
        </select>
      </Champ>
      <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
        <option value="M">Masculin</option><option value="F">Féminin</option>
      </Selec>
      <Selec label="Statut" value={form.statut||"Actif"} onChange={chg("statut")}>
        <option>Actif</option><option>Inactif</option><option>Transféré</option><option>Exclu</option><option>Abandonné</option><option>Décédé</option>
      </Selec>
      <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
        <option>Première inscription</option><option>Réinscription</option>
      </Selec>
      {["Transféré","Exclu","Abandonné","Décédé"].includes(form.statut)&&<>
        <Input label="Date de départ" type="date" value={form.dateDepart||""} onChange={chg("dateDepart")}/>
        <div style={{gridColumn:"1/-1"}}>
          <Input label="Motif du départ" value={form.motifDepart||""} onChange={chg("motifDepart")} placeholder="Ex: Transfert vers Lycée Donka, fin d'année..."/>
        </div>
        {form.statut==="Transféré"&&<div style={{gridColumn:"1/-1"}}>
          <Input label="École de destination" value={form.destinationDepart||""} onChange={chg("destinationDepart")} placeholder="Nom de l'école d'accueil"/>
        </div>}
      </>}
      <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")}/></div>
      <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")}/>
      <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")}/>
      <Input label="Domicile Tuteur" value={form.domicile||""} onChange={chg("domicile")}/>
      <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
      <Input label="Lieu de naissance" value={form.lieuNaissance||""} onChange={chg("lieuNaissance")}/>
      {form.typeInscription==="Réinscription"&&
        <Input label="Établissement d'origine (si transféré)" value={form.etablissementOrigine||""} onChange={chg("etablissementOrigine")} placeholder="Nom de l'ancienne école"/>
      }
    </div>
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
      <Btn disabled={uploadEnCours} onClick={async()=>{
        setUploadEnCours(true);
        try{
          let photoUrl = form.photo || "";
          if(photoUrl.startsWith("data:")){
            photoUrl = await uploadPhotoEleve(photoUrl, schoolId);
          }
          const r={...form, photo:photoUrl, mens:form.mens||initMens()};
          const doublon = findEnrollmentDuplicate(r, tousElevesScolarite, {
            excludeId: modal==="edit_enrol" ? r._id : null,
          });
          if(doublon){
            toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
            return;
          }
          if(modal==="add_enrol") {
            await ajEnrol(r);
            await ensureClasse(r.classe, niveauEnrol);
          } else {
            await modEnrol(r);
          }
          setModal(null);
        }catch(e){
          toast("Erreur upload photo : "+e.message,"error");
        }finally{
          setUploadEnCours(false);
        }
      }}>{uploadEnCours?"⏳ Upload photo...":"Enregistrer"}</Btn>
    </div>
  </Modale>);
}
