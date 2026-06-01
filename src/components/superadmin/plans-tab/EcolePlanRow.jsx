import { C, PLANS } from "../../../constants";
import { EcolePlanPanel } from "./EcolePlanPanel";

// Ligne école : identité, badge plan/expiration, bouton d'édition et
// panneau d'édition déployé en dessous lorsque la ligne est ouverte.
export function EcolePlanRow({
  ecole, now, planModal, setPlanModal, planChoix, setPlanChoix,
  planDuree, setPlanDuree, planSaving, confirmDowngrade, setConfirmDowngrade,
  msgSucces, sauvegarderPlan, planPanelRef, expirationFutureLabel,
}) {
  const p = PLANS[ecole.plan||"gratuit"] || PLANS.gratuit;
  const expired = ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&now>ecole.planExpiry;
  const isOpen = planModal?._id===ecole._id;
  return (
    <div style={{background:"#fff",borderRadius:12,overflow:"hidden",
      boxShadow:"0 2px 12px rgba(0,32,80,0.07)",border:`1px solid ${isOpen?C.blue:"#e5e7eb"}`}}>
      {/* Ligne ecole */}
      <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:160}}>
          <div style={{fontWeight:800,fontSize:14,color:C.blueDark}}>{ecole.nom}</div>
          <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{ecole.ville} - <code style={{fontSize:10}}>{ecole._id}</code></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{display:"inline-block",padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:800,
            background:expired?"#fee2e2":p.bg, color:expired?"#991b1b":p.couleur}}>
            {expired?"Expire":p.label}
          </span>
          {ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&(
            <span style={{fontSize:11,color:expired?"#ef4444":"#9ca3af"}}>
              Exp. {new Date(ecole.planExpiry).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
        <button onClick={()=>{
            if(isOpen){setPlanModal(null);setConfirmDowngrade(false);}
            else{
              setPlanModal(ecole);
              setPlanChoix(ecole.plan||"gratuit");
              setPlanDuree(365);
              setTimeout(()=>planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}),50);
            }
          }}
          style={{background:isOpen?"#0369a1":"#e0f2fe",color:isOpen?"#fff":"#0369a1",
            border:"none",padding:"8px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
            whiteSpace:"nowrap",minWidth:130}}>
          {isOpen?"Fermer":"Modifier le plan"}
        </button>
      </div>

      {isOpen && (
        <EcolePlanPanel
          planChoix={planChoix} setPlanChoix={setPlanChoix} planDuree={planDuree} setPlanDuree={setPlanDuree}
          planSaving={planSaving} confirmDowngrade={confirmDowngrade} setConfirmDowngrade={setConfirmDowngrade}
          msgSucces={msgSucces} sauvegarderPlan={sauvegarderPlan} setPlanModal={setPlanModal}
          planPanelRef={planPanelRef} expirationFutureLabel={expirationFutureLabel}
        />
      )}
    </div>
  );
}
