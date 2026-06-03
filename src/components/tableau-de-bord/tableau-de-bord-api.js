// Écriture Firestore du tableau de bord : demande d'abonnement à un plan.
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebaseDb";

// Crée une demande de changement de plan en attente de validation.
export async function creerDemandePlan({ schoolId, ecoleNom, plan, form }) {
  await addDoc(collection(db, "ecoles", schoolId, "demandes_plan"), {
    ecoleNom,
    planDemande: plan,
    operateur: form.operateur,
    telephone: form.telephone.trim(),
    reference: form.reference.trim(),
    statut: "en_attente",
    createdAt: Date.now(),
  });
}
