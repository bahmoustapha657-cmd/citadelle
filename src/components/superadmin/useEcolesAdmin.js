import { useEffect, useRef, useState } from "react";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { PLANS } from "../../constants";
import { db } from "../../firebaseDb";
import { addDoc, collection, collectionGroup, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { safeOnSnapshot } from "../../firestore-safe";
import { LIFECYCLE_LABELS, NEW_SCHOOL_DEFAULTS } from "./constants";

// Données et handlers métier des onglets Écoles / Plans / Demandes du panel
// super-admin : chargement des écoles + stats, demandes de plan temps réel,
// cycle de vie des écoles, création, et gestion des abonnements.
// `setMsgSucces` sert au feedback transverse de l'orchestrateur.
export function useEcolesAdmin(setMsgSucces) {
  const [ecoles, setEcoles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState({});
  const [recherche, setRecherche] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [confirmationValue, setConfirmationValue] = useState("");
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouvelleEcole, setNouvelleEcole] = useState({nom:"",ville:"",pays:"Guinee"});
  const [demandes, setDemandes] = useState([]);
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
      // Charger les stats en parallele
      const statsMap = {};
      await Promise.all(liste.map(async (e) => {
        const sizeOf = (coll) => getDocs(collection(db,"ecoles",e._id,coll)).then(s=>s.size).catch(()=>0);
        const [elevesP, elevesC, elevesL, comptes, ensP, ensC, ensL] = await Promise.all([
          sizeOf("elevesPrimaire"),
          sizeOf("elevesCollege"),
          sizeOf("elevesLycee"),
          sizeOf("comptes"),
          sizeOf("ensPrimaire"),
          sizeOf("ensCollege"),
          sizeOf("ensLycee"),
        ]);
        statsMap[e._id] = {
          eleves: elevesP + elevesC + elevesL,
          comptes,
          enseignants: ensP + ensC + ensL,
        };
      }));
      setStats(statsMap);
    } catch(err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  };

  const chargerDemandes = () => {
    try {
      const q = collectionGroup(db,"demandes_plan");
      return safeOnSnapshot(q, snap => {
        const liste = snap.docs
          .map(d=>({...d.data(),_id:d.id,_schoolId:d.ref.parent.parent.id}))
          .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
        setDemandes(liste);
      }, ()=>{});
    } catch { return ()=>{}; }
  };

  useEffect(() => {
    chargerEcoles();
    const unsub = chargerDemandes();
    return () => unsub && unsub();
  }, []);

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

  return {
    ecoles, chargement, stats, recherche, setRecherche,
    confirmation, setConfirmation, confirmationValue, setConfirmationValue, confirmationLoading,
    creationOuverte, setCreationOuverte, nouvelleEcole, setNouvelleEcole,
    demandes, ecolesFiltrees,
    planModal, setPlanModal, planChoix, setPlanChoix, planDuree, setPlanDuree,
    planSaving, confirmDowngrade, setConfirmDowngrade, planPanelRef,
    chargerEcoles, validerDemande, rejeterDemande, sauvegarderPlan,
    ouvrirConfirmation, executerCycleVie, genSlug, creerEcole,
  };
}
