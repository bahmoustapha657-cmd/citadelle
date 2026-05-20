import React from "react";
import { C, PLANS, PLAN_DUREES } from "../../constants";

// Onglet "Plans" du Panel Super-Admin.
// Pour chaque école : badge plan actuel + bouton "Modifier le plan"
// qui déploie un panneau inline (choix plan + durée) au-dessus de la
// ligne, scrollé automatiquement à l'ouverture.
// Le state du panneau (planModal, planChoix, planDuree…) reste dans
// le parent — cet onglet n'a pas de state interne propre.
export function PlansTab({
  ecoles,
  recherche,
  chargement,
  planModal, setPlanModal,
  planChoix, setPlanChoix,
  planDuree, setPlanDuree,
  planSaving,
  confirmDowngrade, setConfirmDowngrade,
  msgSucces,
  sauvegarderPlan,
  planPanelRef,
}) {
  // Snapshot du timestamp courant pour cette render : utilisé partout où
  // on compare contre planExpiry (badge "Expire", panneau d'édition…).
  // Date.now() est marqué impur par React Compiler ; ici c'est intentionnel
  // (on veut bien la valeur "au moment du render" pour le badge d'expiration).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expirationFutureLabel = new Date(now + planDuree * 86400000).toLocaleDateString("fr-FR");
  return (
    <div>
      {/* Resume par plan */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
        {Object.entries(PLANS).map(([key,info])=>{
          const count = ecoles.filter(e=>(e.plan||"gratuit")===key).length;
          const expired = key!=="gratuit" ? ecoles.filter(e=>e.plan===key&&e.planExpiry&&now>e.planExpiry).length : 0;
          return (
            <div key={key} style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderTop:`4px solid ${info.couleur}`}}>
              <div style={{fontSize:22,fontWeight:900,color:info.couleur}}>{count}</div>
              <div style={{fontSize:13,fontWeight:700,color:"#374151",marginTop:2}}>{info.label}</div>
              {expired>0&&<div style={{fontSize:11,color:"#ef4444",marginTop:2}}>Alerte: {expired} expire{expired>1?"s":""}</div>}
            </div>
          );
        })}
      </div>

      {/* Liste des ecoles avec gestion plan */}
      {chargement ? (
        <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement...</div>
      ) : ecoles.length===0 ? (
        <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune ecole.</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {ecoles.filter(e=>
            e.nom?.toLowerCase().includes(recherche.toLowerCase())||
            e._id?.toLowerCase().includes(recherche.toLowerCase())
          ).map(ecole=>{
            const p = PLANS[ecole.plan||"gratuit"] || PLANS.gratuit;
            const expired = ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&now>ecole.planExpiry;
            const isOpen = planModal?._id===ecole._id;
            return (
              <div key={ecole._id} style={{background:"#fff",borderRadius:12,overflow:"hidden",
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

                {/* Panneau plan inline */}
                {isOpen && (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
