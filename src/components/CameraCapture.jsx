import React, { useState, useEffect, useRef, useCallback } from "react";
import { C } from "../constants";
import { Btn } from "./ui";

// ══════════════════════════════════════════════════════════════
function CameraCapture({onCapture, onClose}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const [erreur, setErreur] = useState("");
  const [pret, setPret] = useState(false);
  const [facing, setFacing] = useState("user");

  const arreterCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const getCameraErrorMessage = (e) => {
    const detail = e?.message || e?.name || "Erreur inconnue";
    if (!window.isSecureContext) {
      return "Caméra indisponible : la caméra ne fonctionne que sur une page sécurisée (https).";
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      return "Caméra indisponible : votre navigateur ou votre appareil ne prend pas en charge l'accès caméra.";
    }
    if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
      return "Caméra indisponible : l'accès a été refusé. Autorisez la caméra dans le navigateur puis réessayez.";
    }
    if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
      return "Caméra indisponible : aucune caméra détectée sur cet appareil.";
    }
    if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
      return "Caméra indisponible : la caméra est peut-être déjà utilisée par une autre application.";
    }
    return "Caméra indisponible : " + detail;
  };

  const demarrerCamera = useCallback(async (mode) => {
    arreterCamera();
    setPret(false);
    setErreur("");

    if (!window.isSecureContext) {
      setErreur("Caméra indisponible : la caméra ne fonctionne que sur une page sécurisée (https).");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErreur("Caméra indisponible : votre navigateur ou votre appareil ne prend pas en charge l'accès caméra.");
      return;
    }

    const contraintes = [
      { video: { facingMode: { ideal: mode }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
    ];

    let lastError = null;
    for (const config of contraintes) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(config);
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setPret(true);
        }
        return;
      } catch (e) {
        lastError = e;
        if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") break;
      }
    }

    setErreur(getCameraErrorMessage(lastError));
  }, [arreterCamera]);

  const lireFichier = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onCapture(reader.result);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const timer = setTimeout(() => demarrerCamera("user"), 0);
    return () => {
      clearTimeout(timer);
      arreterCamera();
    };
  }, [arreterCamera, demarrerCamera]);

  const inverser = () => { const next = facing==="user"?"environment":"user"; setFacing(next); demarrerCamera(next); };

  const fermer = () => { arreterCamera(); onClose(); };

  const capturer = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d").drawImage(v, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
    fermer();
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:20,maxWidth:460,width:"92%",boxShadow:"0 8px 40px rgba(0,0,0,0.4)"}}>
        <div style={{display:"flex",alignItems:"center",marginBottom:12}}>
          <p style={{margin:0,fontWeight:800,color:C.blueDark,fontSize:15,flex:1}}>📸 Prendre une photo</p>
          {!erreur&&<button onClick={inverser} title="Inverser la caméra"
            style={{background:"#f0f4f8",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:18}}>
            🔄
          </button>}
        </div>
        {erreur
          ? <p style={{color:"#b91c1c",fontSize:13,background:"#fee2e2",padding:"10px 14px",borderRadius:8}}>{erreur}</p>
          : <video ref={videoRef} autoPlay playsInline muted
              style={{width:"100%",borderRadius:10,background:"#000",maxHeight:300,display:"block"}}/>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="user"
          style={{display:"none"}}
          onChange={e=>lireFichier(e.target.files?.[0])}
        />
        <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={fermer}>Annuler</Btn>
          {erreur && <Btn v="ghost" onClick={()=>demarrerCamera(facing)}>Réessayer</Btn>}
          <Btn v="blue" onClick={()=>inputRef.current?.click()}>{erreur ? "Choisir / prendre une photo" : "Choisir une photo"}</Btn>
          {!erreur && pret && <Btn v="vert" onClick={capturer}>📸 Capturer</Btn>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODULE COMPTABILITÉ
// ══════════════════════════════════════════════════════════════

export { CameraCapture };
