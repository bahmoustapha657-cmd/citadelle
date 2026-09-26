import { useState } from "react";
import { C } from "../../../constants";
import { Btn } from "../../ui";
import { CameraCapture } from "../../CameraCapture";
import { lireImageNormalisee } from "../../camera-capture/photo-capture";

// Bloc « Photo de l'élève » des modales d'inscription (complète et rapide) :
// aperçu, prise de vue guidée, import depuis la galerie, suppression. La
// photo reste une data URL jusqu'à l'enregistrement, qui la téléverse
// (uploadPhotoEleve). Une photo de galerie trop lourde est réduite au lieu
// d'être refusée : les photos de téléphone dépassent couramment 3 Mo.
export function PhotoEleveChamp({ photo, onChange, toast }) {
  const [cameraOuverte, setCameraOuverte] = useState(false);

  const importer = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    try {
      onChange(await lireImageNormalisee(fichier));
    } catch {
      toast?.("Image illisible : choisissez une photo JPEG ou PNG.", "warning");
    }
  };

  return (
    <div>
      <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 10px",letterSpacing:"0.07em"}}>📷 Photo de l'élève (optionnel)</p>
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        {/* Cadre au format de la photo (portrait 3:4). */}
        <div style={{width:75,height:100,borderRadius:10,overflow:"hidden",border:`2px solid ${C.blue}`,background:"#f0f4f8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {photo
            ? <img crossOrigin="anonymous" src={photo} alt="Photo de l'élève" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : <span style={{fontSize:32}}>👤</span>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn v="blue" onClick={()=>setCameraOuverte(true)}>📸 {photo ? "Reprendre la photo" : "Prendre une photo"}</Btn>
          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.blue}`,background:"#fff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            📁 Importer depuis la galerie
            <input type="file" accept="image/*" style={{display:"none"}} onChange={importer}/>
          </label>
          {photo&&<Btn sm v="danger" onClick={()=>onChange("")}>✕ Supprimer</Btn>}
        </div>
      </div>
      {cameraOuverte&&<CameraCapture onCapture={onChange} onClose={()=>setCameraOuverte(false)}/>}
    </div>
  );
}
