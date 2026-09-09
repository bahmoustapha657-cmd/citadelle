import { useState, useEffect, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { PLANS } from "../../contexts/PlanContext";
import { demanderPlan } from "../../backend/superadmin-supabase";

export function useUpgradeModal() {
  const { schoolId, schoolInfo } = useContext(SchoolContext);
  const [etape, setEtape] = useState("choix"); // choix | instructions | soumission | attente | succes
  const [form, setForm] = useState({
    telephone: "", operateur: "Orange Money", reference: "", montant: "",
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const chg = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Le SuperAdmin vient d'activer le plan : on passe de l'attente au succès.
  // Plus besoin d'écouter la base ici — schoolInfo est déjà rafraîchi en temps
  // réel par use-school-data (subscribeTable sur `ecoles`), il suffit de le
  // regarder. L'ancien listener visait FIRESTORE : l'écran d'attente ne
  // basculait donc jamais tout seul (liquidation Firebase, lot 5).
  useEffect(() => {
    if (etape === "attente" && schoolInfo?.plan === "pro") setEtape("succes");
  }, [etape, schoolInfo?.plan]);

  const soumettreDemande = async () => {
    if (!form.telephone.trim()) { setErreur("Entrez votre numéro de téléphone."); return; }
    if (!form.reference.trim()) { setErreur("Entrez la référence/code de votre transaction."); return; }
    setChargement(true); setErreur("");
    try {
      const champs = {
        telephone: form.telephone.trim(),
        operateur: form.operateur,
        reference: form.reference.trim(),
        montant: PLANS.pro.prix,
        ecoleNom: schoolInfo?.nom || schoolId,
        createdAt: Date.now(),
      };
      await demanderPlan(schoolId, "pro", champs);
      setEtape("attente");
    } catch {
      setErreur("Erreur lors de la soumission. Réessayez.");
    } finally {
      setChargement(false);
    }
  };

  return { schoolInfo, etape, setEtape, form, setForm, chargement, erreur, chg, soumettreDemande };
}
