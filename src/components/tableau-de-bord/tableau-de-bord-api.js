// Écriture du tableau de bord : demande d'abonnement à un plan.
import { demanderPlan } from "../../backend/superadmin-supabase";

// Crée une demande de changement de plan en attente de validation.
export function creerDemandePlan({ schoolId, ecoleNom, plan, form }) {
  const extra = {
    ecoleNom,
    operateur: form.operateur,
    telephone: form.telephone.trim(),
    reference: form.reference.trim(),
    createdAt: Date.now(),
  };
  return demanderPlan(schoolId, plan, extra);
}
