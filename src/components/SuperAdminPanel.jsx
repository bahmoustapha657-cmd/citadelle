import React, { useEffect, useRef, useState } from "react";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C, PLANS } from "../constants";
import { db } from "../firebaseDb";
import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from "firebase/firestore";

import { EcolesTab } from "./superadmin/EcolesTab";
import { PlansTab } from "./superadmin/PlansTab";
import { DemandesTab } from "./superadmin/DemandesTab";
import { AlertesSentryTab } from "./superadmin/AlertesSentryTab";
import { OutilsTab } from "./superadmin/OutilsTab";
import { LIFECYCLE_LABELS, NEW_SCHOOL_DEFAULTS, S_STYLES } from "./superadmin/constants";

const COLLECTIONS_ANNUELLES = [
  "notesPrimaire","notesCollege","notesLycee",
  "recettes","depenses","salaires","bons","versements","livrets",
];

// =============================================================
//  PANEL SUPER-ADMIN — orchestrateur
// =============================================================
// État partagé (écoles, demandes, plans, Sentry, danger…), handlers
// métier (chargerEcoles, sauvegarderPlan, executerCycleVie…) et la
// navigation entre onglets. Chaque onglet vit dans src/components/
// superadmin/ ; les vues Communications/Assistant restent dans leur
// fichier d'origine.
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
    if (!confirmation || !LIFECYCLE_LABELS[confirmation.action]) return;
    const config = LIFECYCLE_LABELS[confirmation.action];
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
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
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
      ...NEW_SCHOOL_DEFAULTS,
      nom: nouvelleEcole.nom.trim(),
      ville: nouvelleEcole.ville.trim(),
      pays: nouvelleEcole.pays.trim()||"Guinee",
      createdAt: Date.now(),
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

  const S = S_STYLES;

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
        <OutilsTab outilsTab={outilsTab} setOutilsTab={setOutilsTab} ecoles={ecoles}/>
      )}

      {ongletSA==="alertes" && (
        <AlertesSentryTab
          sentryIssues={sentryIssues}
          sentryConfig={sentryConfig}
          sentryLoading={sentryLoading}
          sentryTesting={sentryTesting}
          sentryError={sentryError}
          chargerSentry={chargerSentry}
          testerSentry={testerSentry}
          S={S}
        />
      )}

      {ongletSA==="demandes" && (
        <DemandesTab
          demandes={demandes}
          validerDemande={validerDemande}
          rejeterDemande={rejeterDemande}
          S={S}
        />
      )}

      {ongletSA==="plans" && (
        <PlansTab
          ecoles={ecoles}
          recherche={recherche}
          chargement={chargement}
          planModal={planModal} setPlanModal={setPlanModal}
          planChoix={planChoix} setPlanChoix={setPlanChoix}
          planDuree={planDuree} setPlanDuree={setPlanDuree}
          planSaving={planSaving}
          confirmDowngrade={confirmDowngrade} setConfirmDowngrade={setConfirmDowngrade}
          msgSucces={msgSucces}
          sauvegarderPlan={sauvegarderPlan}
          planPanelRef={planPanelRef}
        />
      )}

      {ongletSA==="ecoles" && (
        <EcolesTab
          ecoles={ecoles}
          ecolesFiltrees={ecolesFiltrees}
          stats={stats}
          chargement={chargement}
          recherche={recherche} setRecherche={setRecherche}
          creationOuverte={creationOuverte} setCreationOuverte={setCreationOuverte}
          nouvelleEcole={nouvelleEcole} setNouvelleEcole={setNouvelleEcole}
          genSlug={genSlug}
          creerEcole={creerEcole}
          confirmation={confirmation} setConfirmation={setConfirmation}
          confirmationValue={confirmationValue} setConfirmationValue={setConfirmationValue}
          confirmationLoading={confirmationLoading}
          executerCycleVie={executerCycleVie}
          ouvrirConfirmation={ouvrirConfirmation}
          lifecycleLabels={LIFECYCLE_LABELS}
          planModal={planModal} setPlanModal={setPlanModal}
          planChoix={planChoix} setPlanChoix={setPlanChoix}
          planDuree={planDuree} setPlanDuree={setPlanDuree}
          planSaving={planSaving}
          confirmDowngrade={confirmDowngrade} setConfirmDowngrade={setConfirmDowngrade}
          msgSucces={msgSucces}
          sauvegarderPlan={sauvegarderPlan}
          planPanelRef={planPanelRef}
          chargerEcoles={chargerEcoles}
          lancerBackfillPublic={lancerBackfillPublic} backfillEnCours={backfillEnCours}
          lancerMigrationAnnee={lancerMigrationAnnee} migrationAnneeEnCours={migrationAnneeEnCours}
          S={S}
        />
      )}
    </div>
  );
}

export default SuperAdminPanel;
