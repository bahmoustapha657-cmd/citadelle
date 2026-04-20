import React, { useState, useEffect, useRef } from "react";
import { C } from "../constants";
import { Btn } from "./ui";

// ══════════════════════════════════════════════════════════════
function CameraCapture({onCapture, onClose}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [erreur, setErreur] = useState("");
  const [pret, setPret] = useState(false);
  const [facing, setFacing] = useState("user");

  const demarrerCamera = (mode) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setPret(false); setErreur("");
    navigator.mediaDevices.getUserMedia({video:{facingMode:mode,width:{ideal:640},height:{ideal:480}},audio:false})
      .then(s => {
        streamRef.current = s;
        if(videoRef.current){
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setPret(true);
        }
      })
      .catch(e => setErreur("Caméra indisponible : " + (e.message||e.name)));
  };

  useEffect(() => {
    const timer = setTimeout(() => demarrerCamera("user"), 0);
    return () => {
      clearTimeout(timer);
      streamRef.current?.getTracks().forEach(t=>t.stop());
    };
  }, []);

  const inverser = () => { const next = facing==="user"?"environment":"user"; setFacing(next); demarrerCamera(next); };

  const fermer = () => { streamRef.current?.getTracks().forEach(t=>t.stop()); onClose(); };

  const capturer = () => {
    const v = videoRef.current;
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
        <div style={{display:"flex",gap:10,marginTop:14,justifyContent:"flex-end"}}>
          <Btn v="ghost" onClick={fermer}>Annuler</Btn>
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
