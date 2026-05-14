import React, { useEffect, useRef, useState } from "react";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C, PLANS, PLAN_DUREES } from "../constants";
import { db } from "../firebaseDb";
import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const COLLECTIONS_ANNUELLES = [
  "notesPrimaire","notesCollege","notesLycee",
  "recettes","depenses","salaires","bons","versements","livrets",
];
import SuperAdminAssistant from "./SuperAdminAssistant";
import CommunicationsAdmin from "./CommunicationsAdmin";

// =============================================================
//  PANEL SUPER-ADMIN
// =============================================================
function SuperAdminPanel() {
  const [ecoles, setEcoles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState({});
  const [recherche, setRecherche] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationValue, setConfirmationValue] = useState("");
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouvelleEcole, setNouvelleEcole] = useState({nom:"",ville:"",pays:"Guinee"});
  const [msgSucces, setMsgSucces] = useState("");
  const [demandes, setDemandes] = useState([]);
  const [ongletSA, setOngletSA] = useState("ecoles");
  const [outilsTab, setOutilsTab] = useState("communications");
  // Gestion plan inline
  const [planModal, setPlanModal] = useState(null);
  const [planChoix, setPlanChoix] = useState("gratuit");
  const [planDuree, setPlanDuree] = useState(365);
  const [planSaving, setPlanSaving] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState(false);
  const [backfillEnCours, setBackfillEnCours] = useState(false);
  const [migrationAnneeEnCours, setMigrationAnneeEnCours] = useState(false);
  const [sentryIssues, setSentryIssues] = useState([]);
  const [sentryConfig, setSentryConfig] = useState(null);
  const [sentryLoading, setSentryLoading] = useState(false);
  const [sentryTesting, setSentryTesting] = useState(false);
  const [sentryError, setSentryError] = useState("");
  const planPanelRef = useRef(null);
  const lifecycleLabels = {
    deactivate: {
      title: "Desactiver l'ecole",
      confirmation: "DESACTIVER",
      success: "Ecole desactivee.",
      description: "L'acces est bloque jusqu'a reactivation.",
      button: "Desactiver",
      color: "#b45309",
      bg: "#fff7ed",
      border: "#fdba74",
    },
    reactivate: {
      title: "Reactiver l'ecole",
      confirmation: "ACTIVER",
      success: "Ecole reactivee.",
      description: "L'ecole redevient accessible.",
      button: "Reactiver",
      color: "#166534",
      bg: "#f0fdf4",
      border: "#86efac",
    },
    delete: {
      title: "Supprimer l'ecole",
      confirmation: "SUPPRIMER",
      success: "Ecole supprimee logiquement.",
      description: "La suppression est logique uniquement. Les donnees restent conservees.",
      button: "Supprimer",
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fca5a5",
    },
  };

  const lancerMigrationAnnee = async () => {
    if(!confirm("Migrer toutes les données legacy sans champ `annee` ?\n\nL'année courante (config/annee) sera assignée à chaque doc des collections suivantes :\n- "+COLLECTIONS_ANNUELLES.join(", ")+"\n\nOpération sûre et idempotente (les docs ayant déjà `annee` sont ignorés).")) return;
    setMigrationAnneeEnCours(true);
    try {
      const snapAnnee = await getDoc(doc(db,"config","annee"));
      const annee = (snapAnnee.exists() && snapAnnee.data().valeur) || "2025-2026";
      const ecolesSnap = await getDocs(collection(db,"ecoles"));
      let totalMaj = 0;
      let totalSkipped = 0;
      let totalEcoles = 0;
      for(const ecoleDoc of ecolesSnap.docs) {
        const sid = ecoleDoc.id;
        totalEcoles++;
        for(const coll of COLLECTIONS_ANNUELLES) {
          const collSnap = await getDocs(collection(db,"ecoles",sid,coll));
          const aMigrer = collSnap.docs.filter(d => !d.data().annee);
          totalSkipped += collSnap.size - aMigrer.length;
          for(let i=0;i<aMigrer.length;i+=400) {
            const batch = writeBatch(db);
            for(const d of aMigrer.slice(i,i+400)) batch.update(d.ref,{annee});
            await batch.commit();
            totalMaj += Math.min(400, aMigrer.length-i);
          }
        }
      }
      setMsgSucces(`Migration terminée : ${totalMaj} doc(s) mis à jour, ${totalSkipped} ignoré(s) (déjà à jour), sur ${totalEcoles} école(s). Année assignée : ${annee}.`);
      setTimeout(() => setMsgSucces(""), 8000);
    } catch(e) {
      setMsgSucces(`Erreur migration : ${e?.message || "échec"}`);
      setTimeout(() => setMsgSucces(""), 6000);
    } finally {
      setMigrationAnneeEnCours(false);
    }
  };

  const chargerSentry = async () => {
    setSentryLoading(true);
    setSentryError("");
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const rCfg = await apiFetch("/sentry-status", { method: "POST", headers, body: JSON.stringify({ action: "config" }) });
      const cfg = await rCfg.json().catch(() => ({}));
      setSentryConfig(cfg);
      if (!cfg.configured) {
        setSentryIssues([]);
        setSentryError(cfg.error || "Sentry non configure.");
        return;
      }
      const r = await apiFetch("/sentry-status", { method: "POST", headers, body: JSON.stringify({ action: "issues" }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSentryError(data.error || "Erreur de chargement des issues Sentry.");
        setSentryIssues([]);
      } else {
        setSentryIssues(Array.isArray(data.issues) ? data.issues : []);
      }
    } catch (e) {
      setSentryError(e?.message || "Erreur reseau.");
    } finally {
      setSentryLoading(false);
    }
  };

  const testerSentry = async () => {
    if (!confirm("Declencher une erreur de test capturee par Sentry ?\n\nUn event apparaitra dans le dashboard Sentry dans la minute.")) return;
    setSentryTesting(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const r = await apiFetch("/sentry-status", { method: "POST", headers, body: JSON.stringify({ action: "test" }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsgSucces(data.message || "Event envoye a Sentry.");
        setTimeout(() => setMsgSucces(""), 6000);
      } else {
        setSentryError(data.error || "Echec du test.");
      }
    } catch (e) {
      setSentryError(e?.message || "Erreur reseau.");
    } finally {
      setSentryTesting(false);
    }
  };

  const lancerBackfillPublic = async () => {
    setBackfillEnCours(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const r = await apiFetch("/ecole-public-sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "backfill" }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsgSucces(`Synchronisation publique effectuee (${data.synced || 0} ecoles).`);
        setTimeout(() => setMsgSucces(""), 4000);
      } else {
        setMsgSucces(`Erreur: ${data.error || "echec backfill"}`);
        setTimeout(() => setMsgSucces(""), 4000);
      }
    } finally {
      setBackfillEnCours(false);
    }
  };

  const chargerEcoles = async () => {
    setChargement(true);
    try {
      const snap = await getDocs(collection(db,"ecoles"));
      const liste = snap.docs.map(d=>({...d.data(),_id:d.id}));
      setEcoles(liste);
      // Charger les stats en parallele
      const statsMap = {};
      await Promise.all(liste.map(async (e) => {
        const [eleves, comptes, enseignants] = await Promise.all([
          getDocs(collection(db,"ecoles",e._id,"elevesPrimaire")).then(s=>s.size).catch(()=>0),
          getDocs(collection(db,"ecoles",e._id,"comptes")).then(s=>s.size).catch(()=>0),
          getDocs(collection(db,"ecoles",e._id,"ensPrimaire")).then(s=>s.size).catch(()=>0),
        ]);
        // Eleves secondaire aussi
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

  useEffect(() => {
    if (ongletSA === "alertes" && sentryConfig === null) {
      chargerSentry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongletSA]);

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
      action:"Plan active",
      details:`Plan ${PLANS[plan]?.label||plan} active par le superadmin - valable 1 an`,
      auteur:"EduGest", date:Date.now(),
    }).catch(()=>{});
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"validee"}:d));
    setEcoles(prev=>prev.map(e=>e._id===demande._schoolId?{...e,...update}:e));
    setMsgSucces(`Plan ${PLANS[plan]?.label||plan} active pour ${demande.ecoleNom}`);
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const rejeterDemande = async (demande) => {
    await updateDoc(doc(db,"ecoles",demande._schoolId,"demandes_plan",demande._id),{statut:"rejetee"});
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"rejetee"}:d));
  };

  const sauvegarderPlan = async () => {
    if(!planModal) return;
    // Protection : downgrade vers Gratuit depuis un plan payant -> double confirmation
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

      // 1. Sauvegarde principale (bloquante)
      await updateDoc(doc(db,"ecoles",planModal._id), update);
      setEcoles(prev=>prev.map(e=>e._id===planModal._id?{...e,...update}:e));

      const planLabel = PLANS[planChoix]?.label ?? "Gratuit";
      const expMsg = update.planExpiry
        ? ` - expire le ${new Date(update.planExpiry).toLocaleDateString("fr-FR")}`
        : "";

      // 2. Feedback immediat + fermeture differee
      setMsgSucces(`Plan ${planLabel} active pour ${planModal.nom}`);
      setTimeout(()=>{ setPlanModal(null);setConfirmDowngrade(false); setMsgSucces(""); }, 2500);
      planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"start"});

      // 3. Notification et push (best-effort, ne bloque pas)
      addDoc(collection(db,"ecoles",planModal._id,"historique"),{
        action: "Plan mis a jour",
        details: `Plan ${planLabel} active par le superadmin${expMsg}`,
        auteur: "EduGest",
        date: Date.now(),
      }).catch(()=>{});

      getAuthHeaders({"Content-Type":"application/json"}).then(headers =>
        apiFetch("/push",{
          method:"POST", headers,
          body: JSON.stringify({
            schoolId: planModal._id,
            cibles: ["admin","direction"],
            titre: `Plan ${planLabel} active`,
            corps: `Votre abonnement ${planLabel} est maintenant actif${expMsg}.`,
            url: "/",
          }),
        })
      ).catch(()=>{});

    } catch(err) {
      console.error("Erreur sauvegarderPlan:", err);
      setMsgSucces("Erreur lors de la sauvegarde. Verifiez votre connexion.");
      setTimeout(()=>setMsgSucces(""),5000);
    } finally {
      setPlanSaving(false);
    }
  };

  const ouvrirConfirmation = (ecole, action) => {
    setConfirmation({ ecole, action });
    setConfirmationValue("");
    setConfirmationLoading(false);
  };

  const executerCycleVie = async () => {
    if (!confirmation || !lifecycleLabels[confirmation.action]) return;
    const config = lifecycleLabels[confirmation.action];
    if (confirmationValue.trim().toUpperCase() !== config.confirmation) return;

    setConfirmationLoading(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const response = await apiFetch("/school-lifecycle", {
        method: "POST",
        headers,
        body: JSON.stringify({
          schoolId: confirmation.ecole._id,
          action: confirmation.action,
          confirmation: config.confirmation,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setMsgSucces(`Erreur: ${data.error || "action impossible"}`);
        setTimeout(() => setMsgSucces(""), 5000);
        return;
      }

      setEcoles((prev) => prev.map((ecole) => (
        ecole._id === confirmation.ecole._id
          ? { ...ecole, actif: data.actif, supprime: data.supprime }
          : ecole
      )));
      setMsgSucces(`${config.success} ${confirmation.ecole.nom}`);
      setTimeout(() => setMsgSucces(""), 4000);
      setConfirmation(null);
      setConfirmationValue("");
    } catch (error) {
      console.error("Erreur school-lifecycle:", error);
      setMsgSucces("Erreur lors de l'action sur l'ecole.");
      setTimeout(() => setMsgSucces(""), 5000);
    } finally {
      setConfirmationLoading(false);
    }
  };

  const genSlug = (nom) =>
    nom.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30)||"ecole";

  const creerEcole = async () => {
    if(!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim()) return;
    const sid = genSlug(nouvelleEcole.nom);
    const existing = await getDoc(doc(db,"ecoles",sid));
    if(existing.exists()){
      setMsgSucces(`Le code ecole "${sid}" existe deja. Choisissez un nom different.`);
      setTimeout(()=>setMsgSucces(""),4000);
      return;
    }
    await setDoc(doc(db,"ecoles",sid),{
      nom: nouvelleEcole.nom.trim(),
      type: "Groupe Scolaire Prive",
      ville: nouvelleEcole.ville.trim(),
      pays: nouvelleEcole.pays.trim()||"Guinee",
      couleur1: "#0A1628",
      couleur2: "#00C48C",
      logo: null,
      devise: "",
      monnaie: "GNF",
      accueil: {
        active: false,
        slogan: "",
        texteAccueil: "",
        bannerUrl: "",
        photos: [],
        showAnnonces: true,
        showHonneurs: true,
        showContact: true,
        telephone: "",
        email: "",
        facebook: "",
        whatsapp: "",
        adresse: "",
      },
      createdAt: Date.now(),
      actif: true,
    });
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      await apiFetch("/ecole-public-sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "sync", schoolId: sid }),
      });
    } catch { /* non-bloquant */ }
    setMsgSucces(`Ecole "${nouvelleEcole.nom}" creee (code: ${sid})`);
    setNouvelleEcole({nom:"",ville:"",pays:"Guinee"});
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
      <h2 style={S.titre}>Panel Super-Admin</h2>
      <p style={S.sous}>Gestion de toutes les ecoles enregistrees sur la plateforme</p>

      {msgSucces && (
        <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:8,padding:"10px 16px",marginBottom:18,fontSize:13,color:"#065f46",fontWeight:600}}>
          {msgSucces}
        </div>
      )}

      {/* Onglets */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[
          {id:"ecoles",label:"Ecoles"},
          {id:"plans",label:"Plans"},
          {id:"outils",label:"Comms & Assistant"},
          {id:"demandes",label:`Demandes${demandes.filter(d=>d.statut==="en_attente").length>0?" ("+demandes.filter(d=>d.statut==="en_attente").length+")":""}`},
          {id:"alertes",label:"Alertes Sentry"},
        ].map(o=>(
          <button key={o.id} onClick={()=>{setOngletSA(o.id);setPlanModal(null);setConfirmDowngrade(false);}}
            style={{padding:"9px 18px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:700,fontSize:13,
              background:ongletSA===o.id?C.blue:"#f0f4f8",color:ongletSA===o.id?"#fff":"#6b7280"}}>
            {o.label}
          </button>
        ))}
      </div>

      {ongletSA==="outils" && (
        <div>
          <div style={{display:"inline-flex",gap:4,padding:4,background:"#f0f4f8",borderRadius:10,marginBottom:18}}>
            {[
              {id:"communications",label:"Diffusion aux écoles"},
              {id:"assistant",label:"Assistant IA"},
            ].map(s=>(
              <button key={s.id} onClick={()=>setOutilsTab(s.id)}
                style={{padding:"7px 16px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:700,fontSize:12,
                  background:outilsTab===s.id?"#fff":"transparent",color:outilsTab===s.id?C.blue:"#6b7280",
                  boxShadow:outilsTab===s.id?"0 1px 4px rgba(0,32,80,0.1)":"none"}}>
                {s.label}
              </button>
            ))}
          </div>
          {outilsTab==="communications" && <CommunicationsAdmin ecoles={ecoles} auteur="superadmin" />}
          {outilsTab==="assistant" && <SuperAdminAssistant />}
        </div>
      )}

      {/* Onglet Alertes Sentry */}
      {ongletSA==="alertes" && (
        <div>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={chargerSentry} disabled={sentryLoading}
              style={{...S.btn("#6b7280"),background:"#f3f4f6",color:"#374151",padding:"8px 14px",fontSize:13,opacity:sentryLoading?0.6:1}}>
              {sentryLoading ? "Chargement..." : "Actualiser"}
            </button>
            <button onClick={testerSentry} disabled={sentryTesting}
              style={{...S.btn("#6b7280"),background:"#fef3c7",color:"#92400e",padding:"8px 14px",fontSize:13,opacity:sentryTesting?0.6:1}}
              title="Declenche une exception capturee par Sentry pour valider la pipeline">
              {sentryTesting ? "Envoi..." : "Tester la capture"}
            </button>
            {sentryConfig?.dashboardUrl && (
              <a href={sentryConfig.dashboardUrl} target="_blank" rel="noopener noreferrer"
                style={{...S.btn("#6b7280"),background:"#eef2ff",color:"#3730a3",padding:"8px 14px",fontSize:13,textDecoration:"none",display:"inline-block"}}>
                Ouvrir Sentry ↗
              </a>
            )}
            {sentryConfig && (
              <span style={{fontSize:11,color:"#64748b",marginLeft:"auto"}}>
                {sentryConfig.configured
                  ? `${sentryConfig.org}/${sentryConfig.project} · ${sentryIssues.length} issue(s) chargee(s)`
                  : "Sentry non configure cote serveur."}
              </span>
            )}
          </div>

          {sentryError && (
            <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#991b1b"}}>
              {sentryError}
            </div>
          )}

          {sentryConfig && !sentryConfig.configured && (
            <div style={{background:"#fef3c7",border:"1px solid #fbbf24",borderRadius:10,padding:"14px 18px",fontSize:12,color:"#92400e",lineHeight:1.6}}>
              <p style={{margin:"0 0 8px",fontWeight:700}}>Configuration requise</p>
              <p style={{margin:0}}>
                Definir les env vars cote serveur : <code>SENTRY_AUTH_TOKEN</code>, <code>SENTRY_ORG_SLUG</code>, <code>SENTRY_PROJECT_SLUG</code>. Le token doit avoir les scopes <code>event:read</code> et <code>project:read</code>.
              </p>
            </div>
          )}

          {sentryConfig?.configured && sentryIssues.length===0 && !sentryLoading && !sentryError && (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af",background:"#fff",borderRadius:12}}>
              Aucune issue Sentry sur les 14 derniers jours.
            </div>
          )}

          {sentryIssues.length>0 && (
            <div style={S.card}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    {["Niveau","Titre","Occurrences","Utilisateurs","Derniere vue",""].map(h=>(
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sentryIssues.map(is=>{
                    const lvlColor = is.level==="fatal"||is.level==="error" ? "#dc2626" : is.level==="warning" ? "#d97706" : "#6b7280";
                    return (
                      <tr key={is.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                        <td style={{...S.td,fontSize:11}}>
                          <span style={{padding:"2px 8px",borderRadius:8,background:`${lvlColor}22`,color:lvlColor,fontWeight:700,textTransform:"uppercase"}}>{is.level||"info"}</span>
                        </td>
                        <td style={{...S.td,fontWeight:600,maxWidth:480}}>
                          <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{is.title}</div>
                          {is.culprit && <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{is.culprit}</div>}
                        </td>
                        <td style={{...S.td,fontWeight:700}}>{is.count}</td>
                        <td style={S.td}>{is.userCount}</td>
                        <td style={{...S.td,fontSize:11,color:"#64748b"}}>{is.lastSeen ? new Date(is.lastSeen).toLocaleString("fr-FR") : "—"}</td>
                        <td style={S.td}>
                          {is.permalink && <a href={is.permalink} target="_blank" rel="noopener noreferrer" style={{color:C.blue,fontSize:12,fontWeight:700,textDecoration:"none"}}>Voir ↗</a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Onglet Demandes Pro */}
      {ongletSA==="demandes" && (
        <div style={S.card}>
          {demandes.length===0 ? (
            <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune demande de souscription.</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["Ecole","Plan demande","Operateur","Telephone","Reference","Date","Statut","Actions"].map(h=>(
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
                      ):"-"}
                    </td>
                    <td style={S.td}>{d.operateur||"-"}</td>
                    <td style={S.td}>{d.telephone}</td>
                    <td style={S.td}><code style={{background:"#f0f4f8",padding:"2px 7px",borderRadius:4,fontSize:11}}>{d.reference}</code></td>
                    <td style={S.td}>{d.createdAt?new Date(d.createdAt).toLocaleDateString("fr-FR"):"-"}</td>
                    <td style={S.td}>
                      <span style={{...S.badge(d.statut==="validee"),
                        background:d.statut==="validee"?"#d1fae5":d.statut==="rejetee"?"#fee2e2":"#fef3c7",
                        color:d.statut==="validee"?"#065f46":d.statut==="rejetee"?"#991b1b":"#92400e"}}>
                        {d.statut==="validee"?"Validee":d.statut==="rejetee"?"Rejetee":"En attente"}
                      </span>
                    </td>
                    <td style={S.td}>
                      {d.statut==="en_attente" && (
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>validerDemande(d)}
                            style={{...S.btn(C.green),background:"#d1fae5",color:"#065f46"}}>
                            Valider
                          </button>
                          <button onClick={()=>rejeterDemande(d)}
                            style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b"}}>
                            Rejeter
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

      {/* Onglet Plans */}
      {ongletSA==="plans" && (
        <div>
          {/* Resume par plan */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
            {Object.entries(PLANS).map(([key,info])=>{
              const count = ecoles.filter(e=>(e.plan||"gratuit")===key).length;
              const expired = key!=="gratuit" ? ecoles.filter(e=>e.plan===key&&e.planExpiry&&Date.now()>e.planExpiry).length : 0;
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
                const expired = ecole.plan&&ecole.plan!=="gratuit"&&ecole.planExpiry&&Date.now()>ecole.planExpiry;
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
      )}

      {/* Onglet Ecoles */}
      {ongletSA==="ecoles" && <>

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
                          const expired=ecole.plan!=="gratuit"&&ecole.planExpiry&&Date.now()>ecole.planExpiry;
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

      {/* Fin onglet ecoles */}
      </>}

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
    </div>
  );
}

export { SuperAdminPanel };
