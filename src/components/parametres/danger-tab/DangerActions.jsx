// Grille des actions sensibles (désactivation / suppression de l'école).
export function DangerActions({ dangerConfig, setDangerAction, setDangerConfirmation, setErreur, setMsgSucces, sec }) {
  return (
    <div style={{...sec,border:"1px solid #fed7aa",background:"#fffaf0"}}>
      <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:800,color:"#9a3412"}}>Zone sensible</h3>
      <p style={{margin:"0 0 18px",fontSize:13,color:"#7c2d12"}}>
        Ces actions coupent l'acces a l'ecole. Elles sont reservees au role direction.
      </p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
        {Object.entries(dangerConfig).map(([key,config])=>(
          <div key={key} style={{border:`1px solid ${config.border}`,background:config.bg,borderRadius:12,padding:"16px 18px"}}>
            <h4 style={{margin:"0 0 6px",fontSize:14,fontWeight:800,color:config.tone}}>{config.title}</h4>
            <p style={{margin:"0 0 14px",fontSize:12,color:"#7c2d12"}}>{config.description}</p>
            <button
              onClick={()=>{
                setDangerAction(key);
                setDangerConfirmation("");
                setErreur("");
                setMsgSucces("");
              }}
              style={{background:config.button,color:"#fff",border:"none",padding:"10px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}
            >
              {config.title}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
