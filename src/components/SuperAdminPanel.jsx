import React, { useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "../apiClient";
import { C, PLANS, PLAN_DUREES } from "../constants";
import { db } from "../firebaseDb";
import { addDoc, collection, collectionGroup, doc, getDocs, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

// ══════════════════════════════════════════════════════════════
//  PANEL SUPER-ADMIN
// ══════════════════════════════════════════════════════════════
function SuperAdminPanel() {
  const [ecoles, setEcoles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState({});
  const [recherche, setRecherche] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouvelleEcole, setNouvelleEcole] = useState({nom:"",ville:"",pays:"Guinée"});
  const [msgSucces, setMsgSucces] = useState("");
  const [demandes, setDemandes] = useState([]);
  const [ongletSA, setOngletSA] = useState("ecoles");
  // Gestion plan inline
  const [planModal, setPlanModal] = useState(null);
  const [planChoix, setPlanChoix] = useState("gratuit");
  const [planDuree, setPlanDuree] = useState(365);
  const [planSaving, setPlanSaving] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const planPanelRef = useRef(null);

  const chargerEcoles = async () => {
    setChargement(true);
    try {
      const snap = await getDocs(collection(db,"ecoles"));
      const liste = snap.docs.map(d=>({...d.data(),_id:d.id}));
      setEcoles(liste);
      // Charger les stats en parallèle
      const statsMap = {};
      await Promise.all(liste.map(async (e) => {
        const [eleves, comptes, enseignants] = await Promise.all([
          getDocs(collection(db,"ecoles",e._id,"elevesPrimaire")).then(s=>s.size).catch(()=>0),
          getDocs(collection(db,"ecoles",e._id,"comptes")).then(s=>s.size).catch(()=>0),
          getDocs(collection(db,"ecoles",e._id,"ensPrimaire")).then(s=>s.size).catch(()=>0),
        ]);
        // Élèves secondaire aussi
        const elevesS = await getDocs(collection(db,"ecoles",e._id,"elevesSecondaire")).then(s=>s.size).catch(()=>0);
        statsMap[e._id] = { eleves: eleves + elevesS, comptes, enseignants };
      }));
      setStats(statsMap);
    } catch(err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerEcoles();
    const unsub = chargerDemandes();
    return () => unsub && unsub();
  }, []);

  const chargerDemandes = () => {
    try {
      const q = collectionGroup(db,"demandes_plan");
      return onSnapshot(q, snap => {
        const liste = snap.docs
          .map(d=>({...d.data(),_id:d.id,_schoolId:d.ref.parent.parent.id}))
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        setDemandes(liste);
      }, ()=>{});
    } catch { return ()=>{}; }
  };

  const validerDemande = async (demande) => {
    const plan = demande.planDemande || "starter";
    const update = {
      plan, planExpiry: Date.now()+365*86400000,
      planActivatedBy:"superadmin", planActivatedAt:Date.now(),
    };
    await updateDoc(doc(db,"ecoles",demande._schoolId), update);
    await updateDoc(doc(db,"ecoles",demande._schoolId,"demandes_plan",demande._id),{statut:"validee"});
    await addDoc(collection(db,"ecoles",demande._schoolId,"historique"),{
      action:"Plan activé",
      details:`Plan ${PLANS[plan]?.label||plan} activé par le superadmin — valable 1 an`,
      auteur:"EduGest", date:Date.now(),
    }).catch(()=>{});
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"validee"}:d));
    setEcoles(prev=>prev.map(e=>e._id===demande._schoolId?{...e,...update}:e));
    setMsgSucces(`Plan ${PLANS[plan]?.label||plan} activé pour ${demande.ecoleNom}`);
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const rejeterDemande = async (demande) => {
    await updateDoc(doc(db,"ecoles",demande._schoolId,"demandes_plan",demande._id),{statut:"rejetee"});
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"rejetee"}:d));
  };

  const sauvegarderPlan = async () => {
    if(!planModal) return;
    // Protection : downgrade vers Gratuit depuis un plan payant → double confirmation
    const estPlanPayant = planModal.plan && planModal.plan !== "gratuit";
    if(planChoix === "gratuit" && estPlanPayant && !confirmDowngrade) {
      setConfirmDowngrade(true);
      return;
    }
    setConfirmDowngrade(false);
    setPlanSaving(true);
    try {
      const update = planChoix === "gratuit"
        ? { plan:"gratuit", planExpiry:null, planActivatedBy:"superadmin", planActivatedAt:Date.now() }
        : { plan:planChoix, planExpiry:Date.now()+planDuree*86400000, planActivatedBy:"superadmin", planActivatedAt:Date.now() };

      // ── 1. Sauvegarde principale (bloquante) ──
      await updateDoc(doc(db,"ecoles",planModal._id), update);
      setEcoles(prev=>prev.map(e=>e._id===planModal._id?{...e,...update}:e));

      const planLabel = PLANS[planChoix]?.label ?? "Gratuit";
      const expMsg = update.planExpiry
        ? ` — expire le ${new Date(update.planExpiry).toLocaleDateString("fr-FR")}`
        : "";

      // ── 2. Feedback immédiat + fermeture différée ──
      setMsgSucces(`✅ Plan ${planLabel} activé pour ${planModal.nom}`);
      setTimeout(()=>{ setPlanModal(null);setConfirmDowngrade(false); setMsgSucces(""); }, 2500);
      planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"start"});

      // ── 3. Notification & push (best-effort, ne bloque pas) ──
      addDoc(collection(db,"ecoles",planModal._id,"historique"),{
        action: "Plan mis à jour",
        details: `Plan ${planLabel} activé par le superadmin${expMsg}`,
        auteur: "EduGest",
        date: Date.now(),
      }).catch(()=>{});

      getAuthHeaders({"Content-Type":"application/json"}).then(headers =>
        fetch("/api/push",{
          method:"POST", headers,
          body: JSON.stringify({
            schoolId: planModal._id,
            cibles: ["admin","direction"],
            titre: `Plan ${planLabel} activé`,
            corps: `Votre abonnement ${planLabel} est maintenant actif${expMsg}.`,
            url: "/",
          }),
        })
      ).catch(()=>{});

    } catch(err) {
      console.error("Erreur sauvegarderPlan:", err);
      setMsgSucces("Erreur lors de la sauvegarde. Vérifiez votre connexion.");
      setTimeout(()=>setMsgSucces(""),5000);
    } finally {
      setPlanSaving(false);
    }
  };

  const toggleActif = async (ecole) => {
    await updateDoc(doc(db,"ecoles",ecole._id), {actif: !ecole.actif});
    setEcoles(prev => prev.map(e => e._id===ecole._id ? {...e,actif:!e.actif} : e));
    setConfirmation(null);
  };

  const supprimerEcole = async (ecole) => {
    // On désactive seulement (suppression physique = risque)
    await updateDoc(doc(db,"ecoles",ecole._id), {actif:false, supprime:true});
    setEcoles(prev => prev.filter(e => e._id!==ecole._id));
    setConfirmation(null);
  };

  const genSlug = (nom) =>
    nom.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30)||"ecole";

  const creerEcole = async () => {
    if(!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim()) return;
    const sid = genSlug(nouvelleEcole.nom);
    await setDoc(doc(db,"ecoles",sid),{
      nom: nouvelleEcole.nom.trim(),
      ville: nouvelleEcole.ville.trim(),
      pays: nouvelleEcole.pays.trim()||"Guinée",
      createdAt: Date.now(),
      actif: true,
    });
    setMsgSucces(`École "${nouvelleEcole.nom}" créée (code : ${sid})`);
    setNouvelleEcole({nom:"",ville:"",pays:"Guinée"});
    setCreationOuverte(false);
    chargerEcoles();
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const ecolesFiltrees = ecoles.filter(e =>
    e.nom?.toLowerCase().includes(recherche.toLowerCase()) ||
    e.ville?.toLowerCase().includes(recherche.toLowerCase()) ||
    e._id?.toLowerCase().includes(recherche.toLowerCase())
  );

  const S = {
    page: {padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f7fb"},
    titre: {margin:"0 0 6px",fontSize:22,fontWeight:900,color:C.blueDark},
    sous: {margin:"0 0 24px",fontSize:12,color:"#9ca3af"},
    card: {background:"#fff",borderRadius:14,boxShadow:"0 2px 16px rgba(0,32,80,0.08)",overflow:"hidden"},
    th: {padding:"10px 14px",fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",textAlign:"left"},
    td: {padding:"12px 14px",fontSize:13,color:"#374151",borderBottom:"1px solid #f0f0f0",verticalAlign:"middle"},
    badge: (actif) => ({
      display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
      background:actif?"#d1fae5":"#fee2e2",color:actif?"#065f46":"#991b1b",
    }),
    btn: (color,bg) => ({background:bg||color,color:color===C.blue?"#fff":color===C.green?"#fff":"#fff",border:"none",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}),
    input: {border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
    modal: {background:"#fff",borderRadius:16,padding:"28px 32px",width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"},
  };

  return (
    <div style={S.page}>
      <h2 style={S.titre}>⚙️ Panel Super-Admin</h2>
      <p style={S.sous}>Gestion de toutes les écoles enregistrées sur la plateforme</p>

      {msgSucces && (
        <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:18,fontSize:13,color:"#065f46",fontWeight:600}}>
          ✅ {msgSucces}
        </div>
      )}

      {/* Onglets */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {[
          {id:"ecoles",label:"🏫 Écoles"},
          {id:"plans",label:"⭐ Plans"},
          {id:"demandes",label:`📋 Demandes${demandes.filter(d=>d.statut==="en_attente").length>0?" ("+demandes.filter(d=>d.statut==="en_attente").length+")":""}`},
        ].map(o=>(
          <button key={o.id} onClick={()=>{setOngletSA(o.id);setPlanModal(null);setConfirmDowngrade(false);}}
            style={{padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
              background:ongletSA===o.id?C.blue:"#f0f4f8",color:ongletSA===o.id?"#fff":"#6b7280"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Onglet Demandes Pro ── */}
      {ongletSA==="demandes" && (
        <div style={S.card}>
          {demandes.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune demande de souscription.</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["École","Plan demandé","Opérateur","Téléphone","Référence","Date","Statut","Actions"].map(h=>(
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandes.map(d=>(
                  <tr key={d._id}>
                    <td style={S.td}><strong>{d.ecoleNom||d._schoolId}</strong></td>
                    <td style={S.td}>
                      {d.planDemande ? (
                        <span style={{display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:800,
                          background:PLANS[d.planDemande]?.bg||"#f3f4f6",color:PLANS[d.planDemande]?.couleur||"#6b7280"}}>
                          {PLANS[d.planDemande]?.label||d.planDemande}
                        </span>
                      ):"—"}
                    </td>
                    <td style={S.td}>{d.operateur||"—"}</td>
                    <td style={S.td}>{d.telephone}</td>
                    <td style={S.td}><code style={{background:"#f0f4f8",padding:"2px 7px",borderRadius:4,fontSize:11}}>{d.reference}</code></td>
                    <td style={S.td}>{d.createdAt?new Date(d.createdAt).toLocaleDateString("fr-FR"):"—"}</td>
                    <td style={S.td}>
                      <span style={{...S.badge(d.statut==="validee"),
                        background:d.statut==="validee"?"#d1fae5":d.statut==="rejetee"?"#fee2e2":"#fef3c7",
                        color:d.statut==="validee"?"#065f46":d.statut==="rejetee"?"#991b1b":"#92400e"}}>
                        {d.statut==="validee"?"✅ Validée":d.statut==="rejetee"?"❌ Rejetée":"⏳ En attente"}
                      </span>
                    </td>
                    <td style={S.td}>
                      {d.statut==="en_attente" && (
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>validerDemande(d)}
                            style={{...S.btn(C.green),background:"#d1fae5",color:"#065f46"}}>
                            ✅ Valider
                          </button>
                          <button onClick={()=>rejeterDemande(d)}
                            style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b"}}>
                            ❌ Rejeter
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Onglet Plans ── */}
      {ongletSA==="plans" && (
        <div>
          {/* Résumé par plan */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
            {Object.entries(PLANS).map(([key,info])=>{
              const count = ecoles.filter(e=>(e.plan||"gratuit")===key).length;
              const expired = key!=="gratuit" ? ecoles.filter(e=>e.plan===key&&e.planExpiry&&Date.now()>e.planExpiry).length : 0;
              return (
                <div key={key} style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderTop:`4px solid ${info.couleur}`}}>
                  <div style={{fontSize:22,fontWeight:900,color:info.couleur}}>{count}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#374151",marginTop:2}}>{info.label}</div>
                  {expired>0&&<div style={{fontSize:11,color:"#ef4444",marginTop:2}}>⚠ {expired} expiré{expired>1?"s":""}</div>}
                </div>
              );
            })}
          </div>

          {/* Liste des écoles avec gestion plan */}
          {chargement ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement…</div>
          ) : ecoles.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune école.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {ecoles.filter(e=>
                e.nom?.toLowerCase().includes(recherche.toLowerCase())||
                e._id?.toLowerCase().includes(recherche.toLowerCase())
              ).map(ecole=>{
                const p = PLANS[ecole.plan||"gratuit"] || PLANS.gratuit;
                const expired = ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&Date.now()>ecole.planExpiry;
                const isOpen = planModal?._id===ecole._id;
                return (
                  <div key={ecole._id} style={{background:"#fff",borderRadius:12,overflow:"hidden",
                    boxShadow:"0 2px 12px rgba(0,32,80,0.07)",border:`1px solid ${isOpen?C.blue:"#e5e7eb"}`}}>
                    {/* Ligne école */}
                    <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",flexWrap:"wrap"}}>
                      <div style={{flex:1,minWidth:160}}>
                        <div style={{fontWeight:800,fontSize:14,color:C.blueDark}}>{ecole.nom}</div>
                        <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{ecole.ville} · <code style={{fontSize:10}}>{ecole._id}</code></div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{display:"inline-block",padding:"3px 12px",borderRadius:20,fontSize:12,fontWeight:800,
                          background:expired?"#fee2e2":p.bg, color:expired?"#991b1b":p.couleur}}>
                          {expired?"⚠ Expiré":p.label}
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
                        {isOpen?"▲ Fermer":"✏ Modifier le plan"}
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
                                {info.eleveLimit===Infinity?"Illimité":`≤ ${info.eleveLimit} élèves`}
                              </div>
                            </button>
                          ))}
                        </div>

                        {planChoix!=="gratuit" && (
                          <div style={{marginBottom:16}}>
                            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
                              Durée
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
                              Expiration : <strong style={{color:C.blueDark}}>{new Date(Date.now()+planDuree*86400000).toLocaleDateString("fr-FR")}</strong>
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
                            <p style={{margin:"0 0 6px",fontWeight:800,fontSize:13,color:"#991b1b"}}>⚠️ Confirmer la désactivation du plan payant ?</p>
                            <p style={{margin:0,fontSize:12,color:"#7f1d1d"}}>Cette école passera au plan Gratuit (≤ 50 élèves). Cette action ne peut pas être annulée automatiquement.</p>
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
                            {planSaving?"Sauvegarde…":confirmDowngrade?"⚠️ Oui, désactiver":"✅ Confirmer le plan"}
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
      )}

      {/* ── Onglet Écoles ── */}
      {ongletSA==="ecoles" && <>

      {/* Barre d'outils */}
      <div style={{display:"flex",gap:12,marginBottom:18,alignItems:"center",flexWrap:"wrap"}}>
        <input value={recherche} onChange={e=>setRecherche(e.target.value)}
          placeholder="🔍 Rechercher une école…"
          style={{...S.input,flex:1,minWidth:200}}/>
        <button onClick={()=>setCreationOuverte(true)}
          style={{...S.btn(C.blue),padding:"8px 18px",fontSize:13,background:`linear-gradient(90deg,${C.blue},${C.green})`}}>
          + Nouvelle école
        </button>
        <button onClick={chargerEcoles}
          style={{...S.btn("#6b7280"),background:"#f3f4f6",color:"#374151",padding:"8px 14px",fontSize:13}}>
          ↻ Actualiser
        </button>
      </div>

      {/* Statistiques globales */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
        {[
          {label:"Écoles totales",val:ecoles.length,icon:"🏫",color:C.blue},
          {label:"Écoles actives",val:ecoles.filter(e=>e.actif).length,icon:"✅",color:C.green},
          {label:"Écoles inactives",val:ecoles.filter(e=>!e.actif).length,icon:"⛔",color:"#ef4444"},
          {label:"Élèves total",val:Object.values(stats).reduce((s,v)=>s+(v.eleves||0),0),icon:"👥",color:"#8b5cf6"},
        ].map(({label,val,icon,color})=>(
          <div key={label} style={{background:"#fff",borderRadius:12,padding:"16px 18px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderLeft:`4px solid ${color}`}}>
            <div style={{fontSize:22}}>{icon}</div>
            <div style={{fontSize:24,fontWeight:900,color,marginTop:4}}>{chargement?"…":val}</div>
            <div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tableau des écoles */}
      <div style={S.card}>
        {chargement ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Chargement des écoles…</div>
        ) : ecolesFiltrees.length===0 ? (
          <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>
            {recherche ? "Aucune école ne correspond à la recherche." : "Aucune école enregistrée."}
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr>
                {["Code","École","Ville/Pays","Créée le","Statut","Plan","Élèves","Comptes","Actions"].map(h=>(
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
                    <td style={S.td}>{ecole.ville}{ecole.pays&&ecole.pays!=="Guinée"?`, ${ecole.pays}`:""}</td>
                    <td style={S.td}>{ecole.createdAt?new Date(ecole.createdAt).toLocaleDateString("fr-FR"):"—"}</td>
                    <td style={S.td}><span style={S.badge(ecole.actif)}>{ecole.actif?"Actif":"Inactif"}</span></td>
                    <td style={S.td}>
                      <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-start"}}>
                        {(()=>{
                          const p=PLANS[ecole.plan]||PLANS.gratuit;
                          const expired=ecole.plan!=="gratuit"&&ecole.planExpiry&&Date.now()>ecole.planExpiry;
                          return (<>
                            <span style={{
                              display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:800,
                              background:expired?"#fee2e2":p.bg, color:expired?"#991b1b":p.couleur,
                            }}>
                              {expired?"⚠ Expiré":p.label}
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
                    <td style={{...S.td,textAlign:"center",fontWeight:700,color:C.blue}}>{st.eleves??"…"}</td>
                    <td style={{...S.td,textAlign:"center",fontWeight:700,color:C.green}}>{st.comptes??"…"}</td>
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
                          {planModal?._id===ecole._id?"▲ Fermer":"Gérer le plan"}
                        </button>
                        <button onClick={()=>setConfirmation({ecole,action:"toggle"})}
                          style={{...S.btn(ecole.actif?C.blue:C.green),background:ecole.actif?"#fee2e2":"#d1fae5",color:ecole.actif?"#991b1b":"#065f46"}}>
                          {ecole.actif?"Désactiver":"Activer"}
                        </button>
                        <button onClick={()=>setConfirmation({ecole,action:"supprimer"})}
                          style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b"}}>
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
              <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.blueDark}}>Gérer le plan — {planModal.nom}</h3>
              <p style={{margin:"4px 0 0",fontSize:12,color:"#6b7280"}}>Plan actuel : <strong>{PLANS[planModal.plan]?.label||"Gratuit"}</strong></p>
            </div>
            <button onClick={()=>setPlanModal(null)}
              style={{background:"#f3f4f6",border:"none",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontWeight:700,fontSize:13,color:"#6b7280"}}>
              ✕ Fermer
            </button>
          </div>

          <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Choisir le plan</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
            {Object.entries(PLANS).map(([key,info])=>(
              <button key={key} onClick={()=>{setPlanChoix(key);setConfirmDowngrade(false);}}
                style={{border:`2px solid ${planChoix===key?info.couleur:"#e5e7eb"}`,borderRadius:10,padding:"12px 10px",cursor:"pointer",textAlign:"left",
                  background:planChoix===key?info.bg:"#f9fafb",transition:"all 0.15s"}}>
                <div style={{fontWeight:800,fontSize:13,color:info.couleur}}>{info.label}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:3}}>{info.eleveLimit===Infinity?"Illimité":`≤ ${info.eleveLimit} élèves`}</div>
              </button>
            ))}
          </div>

          {planChoix !== "gratuit" && (
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Durée de l'abonnement</label>
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
                Expiration : <strong style={{color:C.blueDark}}>{new Date(Date.now()+planDuree*86400000).toLocaleDateString("fr-FR")}</strong>
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
              <p style={{margin:"0 0 6px",fontWeight:800,fontSize:13,color:"#991b1b"}}>⚠️ Confirmer la désactivation du plan payant ?</p>
              <p style={{margin:0,fontSize:12,color:"#7f1d1d"}}>Cette école passera au plan Gratuit (≤ 50 élèves). Cette action ne peut pas être annulée automatiquement.</p>
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
              {planSaving?"Sauvegarde en cours…":confirmDowngrade?"⚠️ Oui, désactiver":"Confirmer le plan"}
            </button>
          </div>
        </div>
      )}

      {/* Fin onglet écoles */}
      </>}

      {/* Modal création d'école */}
      {creationOuverte && (
        <div style={S.overlay} onClick={()=>setCreationOuverte(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 16px",color:C.blueDark,fontSize:17}}>➕ Créer une nouvelle école</h3>
            {[
              {label:"Nom de l'école *",key:"nom",placeholder:"Ex. : École Les Étoiles"},
              {label:"Ville *",key:"ville",placeholder:"Ex. : Conakry"},
              {label:"Pays",key:"pays",placeholder:"Ex. : Guinée"},
            ].map(({label,key,placeholder})=>(
              <div key={key} style={{marginBottom:12}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{label}</label>
                <input value={nouvelleEcole[key]} onChange={e=>setNouvelleEcole(p=>({...p,[key]:e.target.value}))}
                  placeholder={placeholder} style={{...S.input,width:"100%"}}/>
              </div>
            ))}
            {nouvelleEcole.nom && (
              <div style={{background:"#f0f4f8",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#6b7280",marginBottom:14}}>
                Code école généré : <strong style={{color:C.blue}}>{genSlug(nouvelleEcole.nom)}</strong>
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
                Créer l'école
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation désactiver/supprimer — inline */}
      {confirmation && (
        <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:"20px 24px",marginTop:16,boxShadow:"0 2px 12px rgba(0,0,0,0.08)"}}>
          <h3 style={{margin:"0 0 8px",color:C.blueDark,fontSize:16,fontWeight:800}}>
            {confirmation.action==="toggle"?(confirmation.ecole.actif?"Désactiver l'école":"Activer l'école"):"Supprimer l'école"}
          </h3>
          <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>
            {confirmation.action==="toggle"
              ?`Confirmer ${confirmation.ecole.actif?"la désactivation":"l'activation"} de "${confirmation.ecole.nom}" ?`
              :`Cette action masquera définitivement "${confirmation.ecole.nom}". Confirmer ?`}
          </p>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setConfirmation(null)}
              style={{background:"#f3f4f6",border:"none",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:600,color:"#6b7280",fontSize:13}}>
              Annuler
            </button>
            <button onClick={()=>confirmation.action==="toggle"?toggleActif(confirmation.ecole):supprimerEcole(confirmation.ecole)}
              style={{background:confirmation.action==="supprimer"?"#ef4444":`linear-gradient(90deg,${C.blue},${C.green})`,
                border:"none",color:"#fff",padding:"9px 18px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>
              Confirmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { SuperAdminPanel };
