// Écriture Firestore du tableau de bord : demande d'abonnement à un plan.
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { isSupabase } from "../../backend";
import { demanderPlan } from "../../backend/superadmin-supabase";

// Crée une demande de changement de plan en attente de validation.
export async function creerDemandePlan({ schoolId, ecoleNom, plan, form }) {
  const extra = {
    ecoleNom,
    operateur: form.operateur,
    telephone: form.telephone.trim(),
    reference: form.reference.trim(),
    createdAt: Date.now(),
  };
  if (isSupabase) return demanderPlan(schoolId, plan, extra);
  await addDoc(collection(db, "ecoles", schoolId, "demandes_plan"), {
    ...extra, planDemande: plan, statut: "en_attente",
  });
}
