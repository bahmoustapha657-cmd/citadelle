import { C } from "../constants";
import { Btn } from "./ui";
import { useCameraCapture } from "./camera-capture/use-camera-capture";

// Modale de prise de photo : aperçu caméra, bascule avant/arrière, capture ou
// import d'un fichier. Toute la logique du flux est dans use-camera-capture.
function CameraCapture({ onCapture, onClose }) {
  const {
    videoRef, inputRef, erreur, pret, facing,
    demarrerCamera, lireFichier, inverser, fermer, capturer,
  } = useCameraCapture({ onCapture, onClose });

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

export { CameraCapture };
