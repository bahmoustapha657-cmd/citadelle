// Tableau de bord : demande d'abonnement à un plan, en attente de validation
// par le superadmin.
import { demanderPlan } from "../../backend/superadmin-supabase";

export async function creerDemandePlan({ schoolId, ecoleNom, plan, form }) {
  return demanderPlan(schoolId, plan, {
    ecoleNom,
    operateur: form.operateur,
    telephone: form.telephone.trim(),
    reference: form.reference.trim(),
    createdAt: Date.now(),
  });
}
