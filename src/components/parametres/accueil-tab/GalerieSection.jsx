import { C } from "../../../constants";

// Galerie de photos : upload multiple, légendes et suppression par photo.
export function GalerieSection({ accueil, setAccueil, handlePhotoGalerie, inp, sec }) {
  return (
    <div style={sec}>
      <h3 style={{margin:"0 0 16px",fontSize:14,fontWeight:800,color:C.blueDark}}>📸 Galerie de photos</h3>
      <input type="file" accept="image/*" multiple onChange={handlePhotoGalerie}
        style={{...inp,padding:"6px 8px",cursor:"pointer",marginBottom:12}}/>
      {(accueil.photos||[]).length===0&&<p style={{fontSize:12,color:"#94a3b8",margin:0}}>Aucune photo ajoutée</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginTop:8}}>
        {(accueil.photos||[]).map((p,i)=>(
          <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",background:"#f1f5f9"}}>
            <img src={p.url} alt="" style={{width:"100%",height:90,objectFit:"cover",display:"block"}}/>
            <input value={p.caption||""} onChange={e=>{
              const photos=[...accueil.photos];
              photos[i]={...photos[i],caption:e.target.value};
              setAccueil(pa=>({...pa,photos}));
            }} placeholder="Légende..." style={{width:"100%",border:"none",borderTop:"1px solid #e2e8f0",padding:"4px 6px",fontSize:11,outline:"none",boxSizing:"border-box"}}/>
            <button onClick={()=>setAccueil(pa=>({...pa,photos:pa.photos.filter((_,j)=>j!==i)}))}
              style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
