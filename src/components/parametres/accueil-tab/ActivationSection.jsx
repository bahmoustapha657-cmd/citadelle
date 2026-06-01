import { C } from "../../../constants";

// Activation de la page d'accueil publique (interrupteur).
export function ActivationSection({ accueil, setAccueil, sec }) {
  return (
    <div style={{...sec,borderLeft:`4px solid ${accueil.active?C.green:"#e2e8f0"}`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h3 style={{margin:"0 0 4px",fontSize:14,fontWeight:800,color:C.blueDark}}>🌐 Page d'accueil publique</h3>
          <p style={{margin:0,fontSize:12,color:"#64748b"}}>Visible par tous les visiteurs avant connexion — vitrine de votre école</p>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <span style={{fontSize:13,fontWeight:700,color:accueil.active?C.greenDk:"#94a3b8"}}>
            {accueil.active?"✅ Activée":"⭕ Désactivée"}
          </span>
          <div onClick={()=>setAccueil(p=>({...p,active:!p.active}))} style={{
            width:44,height:24,borderRadius:12,cursor:"pointer",transition:"background .2s",
            background:accueil.active?C.green:"#d1d5db",position:"relative",flexShrink:0,
          }}>
            <div style={{
              position:"absolute",top:2,left:accueil.active?22:2,
              width:20,height:20,borderRadius:"50%",background:"#fff",
              transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.25)",
            }}/>
          </div>
        </label>
      </div>
    </div>
  );
}
