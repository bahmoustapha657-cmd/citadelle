// Panneau de confirmation d'une action sensible (saisie du code requis).
export function DangerConfirmation({
  dangerConfig, dangerAction, setDangerAction,
  dangerConfirmation, setDangerConfirmation, dangerLoading, lancerActionEcole,
  schoolInfo, schoolId, inp, sec,
}) {
  const config = dangerAction && dangerConfig[dangerAction];
  if (!config) return null;
  const codeOk = dangerConfirmation.trim().toUpperCase() === config.confirmation;
  return (
    <div style={{...sec,border:`2px solid ${config.border}`,background:config.bg}}>
      <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:800,color:config.tone}}>
        Confirmation requise
      </h3>
      <p style={{margin:"0 0 10px",fontSize:13,color:"#7f1d1d"}}>
        Pour continuer, tapez <strong>{config.confirmation}</strong>.
      </p>
      <p style={{margin:"0 0 14px",fontSize:12,color:"#7f1d1d"}}>
        Ecole concernee : <strong>{schoolInfo.nom || schoolId}</strong>
      </p>
      <input
        style={inp}
        value={dangerConfirmation}
        onChange={(e)=>setDangerConfirmation(e.target.value)}
        placeholder={config.confirmation}
      />
      <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
        <button
          onClick={()=>{ setDangerAction(""); setDangerConfirmation(""); }}
          style={{background:"#e5e7eb",color:"#374151",border:"none",padding:"10px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}
        >
          Annuler
        </button>
        <button
          onClick={lancerActionEcole}
          disabled={dangerLoading || !codeOk}
          style={{
            background:config.button, color:"#fff", border:"none",
            padding:"10px 16px", borderRadius:8,
            cursor:dangerLoading?"not-allowed":"pointer", fontWeight:700, fontSize:13,
            opacity:dangerLoading || !codeOk ? 0.6 : 1,
          }}
        >
          {dangerLoading ? "Traitement..." : config.title}
        </button>
      </div>
    </div>
  );
}
