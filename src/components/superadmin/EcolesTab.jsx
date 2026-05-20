import React from "react";
import { C, PLANS, PLAN_DUREES } from "../../constants";

// Onglet "Ecoles" du Panel Super-Admin.
// Toolbar (recherche + actions globales : nouvelle école, sync public,
// migration année legacy), KPIs (totaux par statut), table des écoles
// avec actions (gérer plan / désactiver-réactiver / supprimer).
// Le panneau d'édition du plan (planModal détaillé) et les modales de
// création + confirmation cycle de vie sont rendus en bas — déclenchés
// par les boutons de la table.
export function EcolesTab({
  // Liste & filtres
  ecoles,
  ecolesFiltrees,
  stats,
  chargement,
  recherche, setRecherche,
  // Création
  creationOuverte, setCreationOuverte,
  nouvelleEcole, setNouvelleEcole,
  genSlug,
  creerEcole,
  // Confirmation cycle de vie
  confirmation, setConfirmation,
  confirmationValue, setConfirmationValue,
  confirmationLoading,
  executerCycleVie,
  ouvrirConfirmation,
  lifecycleLabels,
  // Plan modal (détaillé bottom)
  planModal, setPlanModal,
  planChoix, setPlanChoix,
  planDuree, setPlanDuree,
  planSaving,
  confirmDowngrade, setConfirmDowngrade,
  msgSucces,
  sauvegarderPlan,
  planPanelRef,
  // Actions globales
  chargerEcoles,
  lancerBackfillPublic, backfillEnCours,
  lancerMigrationAnnee, migrationAnneeEnCours,
  // Styles
  S,
}) {
  // Snapshot du timestamp courant : utilisé pour calculer "expired"
  // dans la table + le label d'expiration du modal d'édition de plan.
  // Date.now() est marqué impur par React Compiler ; ici c'est intentionnel
  // (on veut bien la valeur "au moment du render" pour le badge d'expiration).
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expirationFutureLabel = new Date(now + planDuree * 86400000).toLocaleDateString("fr-FR");
  return (
    <>
      {/* Barre d'outils */}
      <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
        <input value={recherche} onChange={e=>setRecherche(e.target.value)}
          placeholder="Rechercher une ecole..."
          style={{...S.input,flex:1,minWidth:200}}/>
        <button onClick={()=>setCreationOuverte(true)}
          style={{...S.btn(C.blue),padding:"8px 18px",fontSize:13,background:`linear-gradient(90deg,${C.blue},${C.green})`}}>
          + Nouvelle ecole
        </button>
        <button onClick={chargerEcoles}
          style={{...S.btn("#6b7280"),background:"#f3f4f6",color:"#374151",padding:"8px 14px",fontSize:13}}>
          Actualiser
        </button>
        <button onClick={lancerBackfillPublic} disabled={backfillEnCours}
          style={{...S.btn("#6b7280"),background:"#eef2ff",color:"#3730a3",padding:"8px 14px",fontSize:13,opacity:backfillEnCours?0.6:1}}>
          {backfillEnCours ? "Synchro..." : "Sync ecoles publiques"}
        </button>
        <button onClick={lancerMigrationAnnee} disabled={migrationAnneeEnCours}
          style={{...S.btn("#6b7280"),background:"#fef3c7",color:"#92400e",padding:"8px 14px",fontSize:13,opacity:migrationAnneeEnCours?0.6:1}}
          title="Assigne le champ `annee` à toutes les données legacy (notes, recettes, dépenses, salaires, bons, versements, livrets).">
          {migrationAnneeEnCours ? "Migration..." : "Migrer annee legacy"}
        </button>
      </div>

      {/* Statistiques globales */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
        {[
          {label:"Ecoles totales",val:ecoles.length,icon:"EC",color:C.blue},
          {label:"Ecoles actives",val:ecoles.filter(e=>e.actif && !e.supprime).length,icon:"ON",color:C.green},
          {label:"Ecoles inactives",val:ecoles.filter(e=>!e.actif && !e.supprime).length,icon:"OFF",color:"#ef4444"},
          {label:"Ecoles supprimees",val:ecoles.filter(e=>e.supprime).length,icon:"DEL",color:"#7f1d1d"},
        ].map(({label,val,icon,color})=>(
          <div key={label} style={{background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderLeft:`4px solid ${color}`}}>
            <div style={{fontSize:22}}>{icon}</div>
            <div style={{fontSize:24,fontWeight:900,color,marginTop:4}}>{chargement?"...":val}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tableau des ecoles */}
      <div style={S.card}>
        {chargement ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement des ecoles...</div>
        ) : ecolesFiltrees.length===0 ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>
            {recherche ? "Aucune ecole ne correspond a la recherche." : "Aucune ecole enregistree."}
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                {["Code","Ecole","Ville/Pays","Creee le","Statut","Plan","Eleves","Comptes","Actions"].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ecolesFiltrees.map(ecole=>{
                const st = stats[ecole._id]||{};
                return (
                  <tr key={ecole._id} style={{transition:"background .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f9fafb"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={S.td}>
                      <code style={{background:"#f0f4f8",padding:"2px 7px",borderRadius:4,fontSize:11,color:C.blue,fontWeight:700}}>
                        {ecole._id}
                      </code>
                    </td>
                    <td style={S.td}><strong>{ecole.nom}</strong></td>
                    <td style={S.td}>{ecole.ville}{ecole.pays&&ecole.pays!=="Guinee"?`, ${ecole.pays}`:""}</td>
                    <td style={S.td}>{ecole.createdAt?new Date(ecole.createdAt).toLocaleDateString("fr-FR"):"-"}</td>
                    <td style={S.td}>
                      <span style={S.badge(ecole.actif && !ecole.supprime)}>
                        {ecole.supprime?"Supprimee":ecole.actif?"Active":"Inactive"}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-start"}}>
                        {(()=>{
                          const p=PLANS[ecole.plan]||PLANS.gratuit;
                          const expired=ecole.plan!=="gratuit"&&ecole.planExpiry&&now>ecole.planExpiry;
                          return (<>
                            <span style={{
                              display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:800,
                              background:expired?"#fee2e2":p.bg, color:expired?"#991b1b":p.couleur,
                            }}>
                              {expired?"Expire":p.label}
                            </span>
                            {ecole.plan!=="gratuit"&&ecole.planExpiry&&(
                              <span style={{fontSize:9,color:expired?"#ef4444":"#9ca3af"}}>
                                Exp. {new Date(ecole.planExpiry).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </>);
                        })()}
                      </div>
                    </td>
                    <td style={{...S.td,textAlign:"center",fontWeight:700,color:C.blue}}>{st.eleves??"..."}</td>
                    <td style={{...S.td,textAlign:"center",fontWeight:700,color:C.green}}>{st.comptes??"..."}</td>
                    <td style={S.td}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>{
                            if(planModal?._id===ecole._id){setPlanModal(null);setConfirmDowngrade(false);}
                            else{
                              setPlanModal(ecole);
                              setPlanChoix(ecole.plan||"gratuit");
                              setPlanDuree(365);
                              setTimeout(()=>planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50);
                            }
                          }}
                          style={{...S.btn(C.blue),background:planModal?._id===ecole._id?"#0369a1":"#e0f2fe",color:planModal?._id===ecole._id?"#fff":"#0369a1"}}>
                          {planModal?._id===ecole._id?"Fermer":"Gerer le plan"}
                        </button>
                        <button onClick={()=>ouvrirConfirmation(ecole, ecole.actif && !ecole.supprime ? "deactivate" : "reactivate")}
                          style={{...S.btn(ecole.actif && !ecole.supprime ? C.blue : C.green),background:ecole.actif && !ecole.supprime ? "#fee2e2" : "#d1fae5",color:ecole.actif && !ecole.supprime ? "#991b1b" : "#065f46"}}>
                          {ecole.actif && !ecole.supprime ? "Desactiver" : "Reactiver"}
                        </button>
                        <button onClick={()=>ouvrirConfirmation(ecole, "delete")}
                          disabled={!!ecole.supprime}
                          style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b",opacity:ecole.supprime?0.5:1,cursor:ecole.supprime?"not-allowed":"pointer"}}>
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Panneau inline gestion plan */}
      {planModal && (
        <div ref={planPanelRef} style={{background:"#fff",border:`2px solid ${PLANS[planChoix]?.couleur||C.blue}`,borderRadius:14,padding:"24px 28px",marginTop:16,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.blueDark}}>Gerer le plan - {planModal.nom}</h3>
              <p style={{margin:"4px 0 0",fontSize:12,color:"#6b7280"}}>Plan actuel : <strong>{PLANS[planModal.plan]?.label||"Gratuit"}</strong></p>
            </div>
            <button onClick={()=>setPlanModal(null)}
              style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:13,color:"#6b7280"}}>
              Fermer
            </button>
          </div>

          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Choisir le plan</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
            {Object.entries(PLANS).map(([key,info])=>(
              <button key={key} onClick={()=>{setPlanChoix(key);setConfirmDowngrade(false);}}
                style={{border:`2px solid ${planChoix===key?info.couleur:"#e5e7eb"}`,borderRadius:10,padding:"12px 10px",cursor:"pointer",textAlign:"left",
                  background:planChoix===key?info.bg:"#f9fafb",transition:"all 0.15s"}}>
                <div style={{fontWeight:800,fontSize:13,color:info.couleur}}>{info.label}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>{info.eleveLimit===Infinity?"Illimite":`<= ${info.eleveLimit} eleves`}</div>
              </button>
            ))}
          </div>

          {planChoix !== "gratuit" && (
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Duree de l'abonnement</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {PLAN_DUREES.map(d=>(
                  <button key={d.jours} onClick={()=>setPlanDuree(d.jours)}
                    style={{border:`2px solid ${planDuree===d.jours?C.blue:"#e5e7eb"}`,borderRadius:8,padding:"8px 18px",cursor:"pointer",
                      background:planDuree===d.jours?"#e0f2fe":"#fff",color:planDuree===d.jours?C.blue:"#374151",
                      fontWeight:planDuree===d.jours?700:400,fontSize:13}}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p style={{margin:"10px 0 0",fontSize:12,color:"#6b7280"}}>
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
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:16,borderTop:"1px solid #f0f0f0"}}>
            <button onClick={()=>setPlanModal(null)}
              style={{background:"#f3f4f6",border:"none",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
              Annuler
            </button>
            <button onClick={sauvegarderPlan} disabled={planSaving||!!msgSucces}
              style={{background:confirmDowngrade?`linear-gradient(90deg,#ef4444,#dc2626)`:`linear-gradient(90deg,${C.blue},${C.green})`,
                border:"none",color:"#fff",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                opacity:(planSaving||!!msgSucces)?0.7:1}}>
              {planSaving?"Sauvegarde en cours...":confirmDowngrade?"Oui, desactiver":"Confirmer le plan"}
            </button>
          </div>
        </div>
      )}

      {/* Modal creation d'ecole */}
      {creationOuverte && (
        <div style={S.overlay} onClick={()=>setCreationOuverte(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",color:C.blueDark,fontSize:17}}>Creer une nouvelle ecole</h3>
            {[
              {label:"Nom de l'ecole *",key:"nom",placeholder:"Ex. : Ecole Les Etoiles"},
              {label:"Ville *",key:"ville",placeholder:"Ex. : Conakry"},
              {label:"Pays",key:"pays",placeholder:"Ex. : Guinee"},
            ].map(({label,key,placeholder})=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</label>
                <input value={nouvelleEcole[key]} onChange={e=>setNouvelleEcole(p=>({...p,[key]:e.target.value}))}
                  placeholder={placeholder} style={{...S.input,width:"100%"}}/>
              </div>
            ))}
            {nouvelleEcole.nom && (
              <div style={{background:"#f0f4f8",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6b7280",marginBottom:14}}>
                Code ecole genere : <strong style={{color:C.blue}}>{genSlug(nouvelleEcole.nom)}</strong>
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>setCreationOuverte(false)}
                style={{background:"#f3f4f6",border:"none",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280"}}>
                Annuler
              </button>
              <button onClick={creerEcole} disabled={!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim()}
                style={{background:`linear-gradient(90deg,${C.blue},${C.green})`,border:"none",color:"#fff",
                  padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,
                  opacity:(!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim())?0.5:1}}>
                Creer l'ecole
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation cycle de vie - inline */}
      {confirmation && (
        <div style={{background:lifecycleLabels[confirmation.action].bg,border:`1px solid ${lifecycleLabels[confirmation.action].border}`,borderRadius:12,padding:"20px 24px",marginTop:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
          <h3 style={{margin:"0 0 8px",color:C.blueDark,fontSize:16,fontWeight:800}}>
            {lifecycleLabels[confirmation.action].title}
          </h3>
          <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>
            {lifecycleLabels[confirmation.action].description}
          </p>
          <p style={{fontSize:12,color:"#6b7280",margin:"0 0 8px"}}>
            Tapez <strong>{lifecycleLabels[confirmation.action].confirmation}</strong> pour continuer sur <strong>{confirmation.ecole.nom}</strong>.
          </p>
          <input
            value={confirmationValue}
            onChange={(e)=>setConfirmationValue(e.target.value)}
            placeholder={lifecycleLabels[confirmation.action].confirmation}
            style={{...S.input,width:"100%",marginBottom:12}}
          />
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setConfirmation(null)}
              style={{background:"#f3f4f6",border:"none",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
              Annuler
            </button>
            <button onClick={executerCycleVie}
              disabled={confirmationLoading || confirmationValue.trim().toUpperCase() !== lifecycleLabels[confirmation.action].confirmation}
              style={{background:confirmation.action==="delete"?"#ef4444":`linear-gradient(90deg,${C.blue},${C.green})`,
                border:"none",color:"#fff",padding:"9px 18px",borderRadius:8,cursor:confirmationLoading?"not-allowed":"pointer",fontWeight:700,fontSize:13,
                opacity:confirmationLoading || confirmationValue.trim().toUpperCase() !== lifecycleLabels[confirmation.action].confirmation ? 0.6 : 1}}>
              {confirmationLoading ? "Traitement..." : lifecycleLabels[confirmation.action].button}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
