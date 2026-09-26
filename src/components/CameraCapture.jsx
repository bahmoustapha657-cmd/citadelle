import { useState } from "react";
import { C } from "../constants";
import { Btn } from "./ui";
import { useCameraCapture } from "./camera-capture/use-camera-capture";
import { useFaceGuidance } from "./camera-capture/use-face-guidance";
import { GuideVisage } from "./camera-capture/GuideVisage";
import { libelleCamera } from "./camera-capture/camera-constraints";
import { lireImageNormalisee } from "./camera-capture/photo-capture";

// Modale de prise de photo d'élève : caméra en haute définition (la meilleure
// que propose l'appareil), guidage du visage en direct, photo automatique
// quand le cadrage est bon, recadrage portrait 3:4 centré sur le visage, puis
// vérification avant de garder la photo. Import d'un fichier toujours
// possible, et seul recours si la caméra est indisponible.
//
// Flux caméra : camera-capture/use-camera-capture.js ; guidage :
// use-face-guidance.js ; géométrie du cadrage : photo-framing.js.

const CLE_AUTO = "edugest_camera_auto";
const lireAuto = () => {
  try { return localStorage.getItem(CLE_AUTO) !== "0"; } catch { return true; }
};

const FOND_CONSIGNE = {
  bon: "rgba(22,163,74,0.92)",
  attention: "rgba(180,83,9,0.92)",
  neutre: "rgba(15,23,42,0.78)",
};

function consigne(statut, guidage, auto) {
  if (statut === "chargement") return { texte: "Préparation de la détection du visage…", fond: FOND_CONSIGNE.neutre };
  if (statut === "indisponible" || !guidage) return { texte: "Placez le visage dans l'ovale", fond: FOND_CONSIGNE.neutre };
  if (guidage.etat === "absent") return { texte: guidage.message, fond: FOND_CONSIGNE.neutre };
  if (guidage.bon && !auto) return { texte: "Parfait ! Appuyez sur « Capturer »", fond: FOND_CONSIGNE.bon };
  const bon = guidage.bon || guidage.etat === "bouge";
  return { texte: guidage.message, fond: bon ? FOND_CONSIGNE.bon : FOND_CONSIGNE.attention };
}

// En dessous, l'élève était trop loin : la photo manquera de détail.
const HAUTEUR_PHOTO_CONSEILLEE = 480;

const styleBoutonImage = {
  display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,
  border:`1.5px solid ${C.blue}`,background:"#fff",color:C.blue,fontSize:13,fontWeight:700,cursor:"pointer",
};

function CameraCapture({ onCapture, onClose }) {
  const {
    videoRef, attacherVideo, surDimensions, erreur, pret, cameras, deviceId, miroir,
    libelleDefinition, demarrerCamera, basculerCamera, arreterCamera,
  } = useCameraCapture();
  const [auto, setAuto] = useState(lireAuto);
  const [revue, setRevue] = useState(null);
  const [erreurImport, setErreurImport] = useState("");
  const enDirect = !erreur && !revue;
  const surPhoto = (photo) => setRevue({ ...photo, source: "camera" });
  const { statut, guidage, capturer } = useFaceGuidance({ videoRef, actif: enDirect && pret, auto, onPhoto: surPhoto });

  const changerAuto = (e) => {
    const actif = e.target.checked;
    setAuto(actif);
    try { localStorage.setItem(CLE_AUTO, actif ? "1" : "0"); } catch { /* stockage indisponible */ }
  };

  const importer = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier) return;
    setErreurImport("");
    try {
      setRevue({ dataUrl: await lireImageNormalisee(fichier), source: "import" });
    } catch {
      setErreurImport("Image illisible : choisissez une photo JPEG ou PNG.");
    }
  };

  const fermer = () => { arreterCamera(); onClose(); };
  const utiliser = () => { arreterCamera(); onCapture(revue.dataUrl); onClose(); };

  const { texte, fond } = consigne(statut, guidage, auto);
  const conseil = enDirect && statut === "pret" ? guidage?.conseil : "";

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo de l'élève"
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:10,boxSizing:"border-box"}}>
      <div style={{background:"#fff",borderRadius:16,padding:16,maxWidth:480,width:"100%",maxHeight:"100%",overflowY:"auto",boxSizing:"border-box",boxShadow:"0 8px 40px rgba(0,0,0,0.4)",textAlign:"left",lineHeight:1.4}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <p style={{margin:0,fontWeight:800,color:C.blueDark,fontSize:15,flex:1}}>
            {revue ? "✅ Vérifiez la photo" : "📸 Photo de l'élève"}
          </p>
          {enDirect && libelleDefinition && (
            <span title="Définition fournie par la caméra"
              style={{fontSize:11,fontWeight:700,color:"#0f766e",background:"#ccfbf1",padding:"3px 8px",borderRadius:20,whiteSpace:"nowrap"}}>
              {libelleDefinition}
            </span>
          )}
        </div>

        {enDirect && cameras.length > 2 && (
          <select value={deviceId} onChange={(e) => demarrerCamera(e.target.value)} aria-label="Caméra"
            style={{width:"100%",marginBottom:10,border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
            {cameras.map((camera, i) => <option key={camera.deviceId} value={camera.deviceId}>{libelleCamera(camera, i)}</option>)}
          </select>
        )}

        {erreur && !revue
          ? <p style={{color:"#b91c1c",fontSize:13,background:"#fee2e2",padding:"10px 14px",borderRadius:8}}>{erreur}</p>
          : (
            <div style={{position:"relative",width:"max(220px, min(100%, calc((100vh - 250px) * 0.75)))",aspectRatio:"3 / 4",margin:"0 auto",borderRadius:12,overflow:"hidden",background:"#000"}}>
              {!erreur && <video ref={attacherVideo} autoPlay playsInline muted
                onLoadedMetadata={surDimensions} onResize={surDimensions}
                style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",transform:miroir?"scaleX(-1)":"none"}}/>}
              {enDirect && <GuideVisage guidage={statut === "pret" && pret ? guidage : null} miroir={miroir} progression={auto && pret ? guidage?.progression : 0}/>}
              {enDirect && !pret && (
                <p style={{position:"absolute",inset:0,margin:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13}}>
                  Ouverture de la caméra…
                </p>
              )}
              {enDirect && pret && (
                <p aria-live="polite"
                  style={{position:"absolute",left:"50%",bottom:12,transform:"translateX(-50%)",margin:0,maxWidth:"90%",width:"max-content",
                    textAlign:"center",background:fond,color:"#fff",fontSize:13,fontWeight:700,padding:"6px 12px",borderRadius:999}}>
                  {texte}
                </p>
              )}
              {enDirect && cameras.length > 1 && (
                <button type="button" onClick={basculerCamera} title="Changer de caméra" aria-label="Changer de caméra"
                  style={{position:"absolute",top:10,right:10,width:40,height:40,borderRadius:"50%",border:"none",background:"rgba(15,23,42,0.6)",color:"#fff",fontSize:18,cursor:"pointer"}}>
                  🔄
                </button>
              )}
              {revue && <img src={revue.dataUrl} alt="Photo de l'élève"
                style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",background:"#0f172a"}}/>}
            </div>
          )}

        {conseil && <p style={{margin:"10px 0 0",fontSize:12,color:"#92400e",background:"#fef3c7",padding:"8px 10px",borderRadius:8}}>💡 {conseil}</p>}
        {enDirect && statut === "indisponible" && (
          <p style={{margin:"10px 0 0",fontSize:12,color:"#475569"}}>
            Détection du visage indisponible sur cet appareil : cadrez le visage dans l'ovale, puis capturez.
          </p>
        )}
        {enDirect && statut === "pret" && (
          <label style={{display:"flex",alignItems:"center",gap:8,marginTop:10,fontSize:12,color:"#334155",cursor:"pointer"}}>
            <input type="checkbox" checked={auto} onChange={changerAuto}/>
            Photo automatique dès que le visage est bien cadré
          </label>
        )}
        {revue && (
          <p style={{margin:"10px 0 0",fontSize:12,color:"#475569",textAlign:"center"}}>
            {revue.source === "import" ? "Photo importée" : `${revue.largeur}×${revue.hauteur} px${revue.recadree ? " · recadrée sur le visage" : ""}`}
          </p>
        )}
        {revue?.source === "camera" && revue.hauteur < HAUTEUR_PHOTO_CONSEILLEE && (
          <p style={{margin:"8px 0 0",fontSize:12,color:"#92400e",background:"#fef3c7",padding:"8px 10px",borderRadius:8}}>
            💡 Photo peu détaillée : l'élève était loin de la caméra. Rapprochez-le, puis reprenez la photo.
          </p>
        )}
        {erreurImport && <p style={{margin:"10px 0 0",fontSize:12,color:"#b91c1c"}}>{erreurImport}</p>}

        <div style={{display:"flex",gap:8,marginTop:14,justifyContent:"flex-end",flexWrap:"wrap"}}>
          <Btn v="ghost" onClick={fermer}>Annuler</Btn>
          {revue ? (
            <>
              <Btn v="ghost" onClick={() => setRevue(null)}>↺ Reprendre</Btn>
              <Btn v="vert" onClick={utiliser}>✓ Utiliser cette photo</Btn>
            </>
          ) : (
            <>
              {erreur && <Btn v="ghost" onClick={() => demarrerCamera()}>Réessayer</Btn>}
              <label style={styleBoutonImage}>
                📁 Importer
                <input type="file" accept="image/*" style={{display:"none"}} onChange={importer}/>
              </label>
              {/* Caméra inaccessible dans la page : l'appareil photo du
                  téléphone reste disponible via le sélecteur de fichier. */}
              {erreur && (
                <label style={styleBoutonImage}>
                  📷 Appareil photo
                  <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={importer}/>
                </label>
              )}
              {!erreur && <Btn v="vert" disabled={!pret} onClick={capturer}>📸 Capturer</Btn>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { CameraCapture };
