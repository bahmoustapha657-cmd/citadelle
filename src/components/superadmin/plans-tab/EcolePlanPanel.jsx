import { C, PLANS, PLAN_DUREES } from "../../../constants";

// Panneau d'édition de plan déployé sous une ligne école : choix du plan,
// durée, confirmation de rétrogradation et actions.
export function EcolePlanPanel({
  planChoix, setPlanChoix, planDuree, setPlanDuree, planSaving,
  confirmDowngrade, setConfirmDowngrade, msgSucces, sauvegarderPlan,
  setPlanModal, planPanelRef, expirationFutureLabel,
}) {
  return (
    <div ref={planPanelRef} style={{borderTop:`2px solid ${PLANS[planChoix]?.couleur||C.blue}`,
      padding:"20px 18px 18px",background:"#f9fafb"}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>
        Choisir le nouveau plan
      </label>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:16}}>
        {Object.entries(PLANS).map(([key,info])=>(
          <button key={key} onClick={()=>{setPlanChoix(key);setConfirmDowngrade(false);}}
            style={{border:`2px solid ${planChoix===key?info.couleur:"#e5e7eb"}`,borderRadius:10,
              padding:"12px 10px",cursor:"pointer",textAlign:"left",
              background:planChoix===key?info.bg:"#fff",transition:"all 0.15s"}}>
            <div style={{fontWeight:800,fontSize:13,color:info.couleur}}>{info.label}</div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>
              {info.eleveLimit===Infinity?"Illimite":`max ${info.eleveLimit} eleves`}
            </div>
          </button>
        ))}
      </div>

      {planChoix!=="gratuit" && (
        <div style={{marginBottom:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
            Duree
          </label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {PLAN_DUREES.map(d=>(
              <button key={d.jours} onClick={()=>setPlanDuree(d.jours)}
                style={{border:`2px solid ${planDuree===d.jours?C.blue:"#e5e7eb"}`,borderRadius:8,
                  padding:"7px 16px",cursor:"pointer",
                  background:planDuree===d.jours?"#e0f2fe":"#fff",
                  color:planDuree===d.jours?C.blue:"#374151",
                  fontWeight:planDuree===d.jours?700:400,fontSize:13}}>
                {d.label}
              </button>
            ))}
          </div>
          <p style={{margin:"8px 0 0",fontSize:12,color:"#6b7280"}}>
            Expiration : <strong style={{color:C.blueDark}}>{expirationFutureLabel}</strong>
          </p>
        </div>
      )}

      {msgSucces && (
        <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:12,fontSize:13,color:"#065f46",fontWeight:700}}>
          {msgSucces}
        </div>
      )}
      {confirmDowngrade && (
        <div style={{background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
          <p style={{margin:"0 0 6px",fontWeight:800,fontSize:13,color:"#991b1b"}}>Confirmer la desactivation du plan payant ?</p>
          <p style={{margin:0,fontSize:12,color:"#7f1d1d"}}>Cette ecole passera au plan Gratuit (max 50 eleves). Cette action ne peut pas etre annulee automatiquement.</p>
        </div>
      )}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>{setPlanModal(null);setConfirmDowngrade(false);}}
          style={{background:"#f3f4f6",border:"none",padding:"9px 20px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
          Annuler
        </button>
        <button onClick={sauvegarderPlan} disabled={planSaving||!!msgSucces}
          style={{background:confirmDowngrade?`linear-gradient(90deg,#ef4444,#dc2626)`:`linear-gradient(90deg,${C.blue},${C.green})`,
            border:"none",color:"#fff",padding:"9px 28px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
            opacity:(planSaving||!!msgSucces)?0.7:1}}>
          {planSaving?"Sauvegarde...":confirmDowngrade?"Oui, desactiver":"Confirmer le plan"}
        </button>
      </div>
    </div>
  );
}
