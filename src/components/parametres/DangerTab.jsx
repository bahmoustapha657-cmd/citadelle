import React from "react";

// Onglet "Danger" de ParametresEcole.
// Désactivation / suppression logique de l'école — réservé direction.
// Le parent gère l'état dangerAction/dangerConfirmation et la requête
// API ; cet onglet n'est qu'une présentation des actions disponibles.
export function DangerTab({
  // Config des actions (deactivate / delete)
  dangerConfig,
  dangerAction,
  setDangerAction,
  dangerConfirmation,
  setDangerConfirmation,
  dangerLoading,
  lancerActionEcole,
  setErreur,
  setMsgSucces,
  // Identité école (pour le bloc de confirmation)
  schoolInfo,
  schoolId,
  // Styles partagés
  inp,
  sec,
}) {
  return (
    <>
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

      {dangerAction&&dangerConfig[dangerAction]&&(
        <div style={{...sec,border:`2px solid ${dangerConfig[dangerAction].border}`,background:dangerConfig[dangerAction].bg}}>
          <h3 style={{margin:"0 0 8px",fontSize:16,fontWeight:800,color:dangerConfig[dangerAction].tone}}>
            Confirmation requise
          </h3>
          <p style={{margin:"0 0 10px",fontSize:13,color:"#7f1d1d"}}>
            Pour continuer, tapez <strong>{dangerConfig[dangerAction].confirmation}</strong>.
          </p>
          <p style={{margin:"0 0 14px",fontSize:12,color:"#7f1d1d"}}>
            Ecole concernee : <strong>{schoolInfo.nom || schoolId}</strong>
          </p>
          <input
            style={inp}
            value={dangerConfirmation}
            onChange={(e)=>setDangerConfirmation(e.target.value)}
            placeholder={dangerConfig[dangerAction].confirmation}
          />
          <div style={{display:"flex",gap:10,marginTop:16,flexWrap:"wrap"}}>
            <button
              onClick={()=>{
                setDangerAction("");
                setDangerConfirmation("");
              }}
              style={{background:"#e5e7eb",color:"#374151",border:"none",padding:"10px 14px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}
            >
              Annuler
            </button>
            <button
              onClick={lancerActionEcole}
              disabled={dangerLoading || dangerConfirmation.trim().toUpperCase() !== dangerConfig[dangerAction].confirmation}
              style={{
                background:dangerConfig[dangerAction].button,
                color:"#fff",
                border:"none",
                padding:"10px 16px",
                borderRadius:8,
                cursor:dangerLoading?"not-allowed":"pointer",
                fontWeight:700,
                fontSize:13,
                opacity:dangerLoading || dangerConfirmation.trim().toUpperCase() !== dangerConfig[dangerAction].confirmation ? 0.6 : 1,
              }}
            >
              {dangerLoading ? "Traitement..." : dangerConfig[dangerAction].title}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
