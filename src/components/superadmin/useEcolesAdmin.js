import { useEffect, useRef, useState } from "react";
import { PLANS } from "../../constants";
import { LIFECYCLE_LABELS } from "./constants";
import { genSlug, buildPlanUpdate, filtrerEcoles } from "./ecoles-admin/ecoles-admin-logic";
import {
  chargerEcolesAvecStats, souscrireDemandes, validerDemandeApi, rejeterDemandeApi,
  appliquerPlan, executerCycleVieApi, creerEcoleApi,
} from "./ecoles-admin/ecoles-admin-api";

// Données et handlers métier des onglets Écoles / Plans / Demandes du panel
// super-admin. L'état et les mises à jour optimistes vivent ici ; les accès
// Firestore/réseau sont dans ./ecoles-admin/ecoles-admin-api et les helpers
// purs dans ./ecoles-admin/ecoles-admin-logic.
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
      const { liste, statsMap } = await chargerEcolesAvecStats();
      setEcoles(liste);
      setStats(statsMap);
    } catch(err) {
      console.error(err);
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerEcoles();
    const unsub = souscrireDemandes(setDemandes);
    return () => unsub && unsub();
  }, []);

  const validerDemande = async (demande) => {
    const { plan, update } = await validerDemandeApi(demande);
    setDemandes(prev=>prev.map(d=>d._id===demande._id?{...d,statut:"validee"}:d));
    setEcoles(prev=>prev.map(e=>e._id===demande._schoolId?{...e,...update}:e));
    setMsgSucces(`Plan ${PLANS[plan]?.label||plan} active pour ${demande.ecoleNom}`);
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const rejeterDemande = async (demande) => {
    await rejeterDemandeApi(demande);
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
      const update = buildPlanUpdate(planChoix, planDuree);
      const planLabel = PLANS[planChoix]?.label ?? "Gratuit";
      const expMsg = update.planExpiry
        ? ` - expire le ${new Date(update.planExpiry).toLocaleDateString("fr-FR")}`
        : "";

      await appliquerPlan(planModal._id, update, { planLabel, expMsg });
      setEcoles(prev=>prev.map(e=>e._id===planModal._id?{...e,...update}:e));

      setMsgSucces(`Plan ${planLabel} active pour ${planModal.nom}`);
      setTimeout(()=>{ setPlanModal(null);setConfirmDowngrade(false); setMsgSucces(""); }, 2500);
      planPanelRef.current?.scrollIntoView({behavior:"smooth",block:"start"});
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
      const { ok, data } = await executerCycleVieApi({
        schoolId: confirmation.ecole._id,
        action: confirmation.action,
        confirmation: config.confirmation,
      });
      if (!ok) {
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

  const creerEcole = async () => {
    if(!nouvelleEcole.nom.trim()||!nouvelleEcole.ville.trim()) return;
    const sid = genSlug(nouvelleEcole.nom);
    const { ok } = await creerEcoleApi(nouvelleEcole, sid);
    if(!ok){
      setMsgSucces(`Le code ecole "${sid}" existe deja. Choisissez un nom different.`);
      setTimeout(()=>setMsgSucces(""),4000);
      return;
    }
    setMsgSucces(`Ecole "${nouvelleEcole.nom}" creee (code: ${sid})`);
    setNouvelleEcole({nom:"",ville:"",pays:"Guinee"});
    setCreationOuverte(false);
    chargerEcoles();
    setTimeout(()=>setMsgSucces(""),4000);
  };

  const ecolesFiltrees = filtrerEcoles(ecoles, recherche);

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
