// ══════════════════════════════════════════════════════════════
//  Bandeau « Installer l'application » (PWA)
// ══════════════════════════════════════════════════════════════
export function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div style={{position:"fixed",bottom:16,left:"50%",transform:"translateX(-50%)",
      zIndex:9998,background:"#0A1628",color:"#fff",borderRadius:14,
      padding:"12px 20px",display:"flex",alignItems:"center",gap:14,
      boxShadow:"0 8px 32px rgba(0,0,0,0.45)",maxWidth:360,width:"calc(100% - 32px)"}}>
      <span style={{fontSize:28}}>📲</span>
      <div style={{flex:1}}>
        <p style={{margin:"0 0 2px",fontWeight:800,fontSize:14}}>Installer EduGest</p>
        <p style={{margin:0,fontSize:12,color:"rgba(255,255,255,0.65)"}}>Accès rapide, fonctionne hors ligne</p>
      </div>
      <button onClick={onInstall}
        style={{background:"#00C48C",color:"#fff",border:"none",borderRadius:8,
          padding:"8px 14px",fontSize:13,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>
        Installer
      </button>
      <button onClick={onDismiss}
        style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",
          fontSize:18,cursor:"pointer",padding:"4px",lineHeight:1}}>✕</button>
    </div>
  );
}
