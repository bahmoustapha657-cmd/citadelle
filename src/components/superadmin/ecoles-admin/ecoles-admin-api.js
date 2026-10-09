// Accès données des onglets Écoles / Plans / Demandes du panel super-admin :
// chargement écoles+stats, abonnement aux demandes, validation de plan,
// application de plan, cycle de vie et création d'école.
import * as sbAdmin from "../../../backend/superadmin-supabase";

// Charge toutes les écoles + leurs stats (effectifs, comptes, enseignants).
export function chargerEcolesAvecStats() {
  return sbAdmin.chargerEcolesAvecStats();
}

// Abonnement temps réel aux demandes de plan. Renvoie l'unsub.
export function souscrireDemandes(onData) {
  return sbAdmin.souscrireDemandes(onData);
}

// Valide une demande : active le plan, marque la demande, trace l'historique.
// Renvoie { plan, update } pour la mise à jour optimiste côté hook.
export function validerDemandeApi(demande) {
  return sbAdmin.validerDemandeApi(demande);
}

export function rejeterDemandeApi(demande) {
  return sbAdmin.rejeterDemandeApi(demande);
}

// Applique un plan à une école.
export function appliquerPlan(ecoleId, update) {
  return sbAdmin.appliquerPlan(ecoleId, update);
}

// Action de cycle de vie sur une école. Renvoie { ok, data }.
export function executerCycleVieApi({ schoolId, action, confirmation }) {
  return sbAdmin.executerCycleVieApi({ schoolId, action, confirmation });
}

// Crée une école si le code (slug) est libre.
// Renvoie { ok:false } si le code existe déjà, sinon { ok:true }.
export function creerEcoleApi(nouvelleEcole, sid) {
  return sbAdmin.creerEcoleApi(nouvelleEcole, sid);
}
