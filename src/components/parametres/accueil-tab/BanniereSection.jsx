import { C } from "../../../constants";

// Image bannière (hero) : aperçu, upload fichier, URL et suppression.
export function BanniereSection({ accueil, setAccueil, handleBanniere, inp, lbl, sec }) {
  return (
    <div style={sec}>
      <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>🖼️ Image bannière (hero)</h3>
      {accueil.bannerUrl&&<div style={{marginBottom:12,borderRadius:10,overflow:"hidden",height:120,background:"#f1f5f9"}}>
        <img src={accueil.bannerUrl} alt="Bannière" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      </div>}
      <input type="file" accept="image/*" onChange={handleBanniere} style={{...inp,padding:"6px 8px",cursor:"pointer"}}/>
      <label style={lbl}>Ou coller une URL</label>
      <input style={inp} value={accueil.bannerUrl.startsWith("data:")?"":accueil.bannerUrl}
        onChange={e=>setAccueil(p=>({...p,bannerUrl:e.target.value}))}
        placeholder="https://...jpg"/>
      {accueil.bannerUrl&&<button onClick={()=>setAccueil(p=>({...p,bannerUrl:""}))}
        style={{marginTop:8,background:"#fee2e2",border:"none",color:"#991b1b",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>
        ✕ Supprimer la bannière
      </button>}
    </div>
  );
}
