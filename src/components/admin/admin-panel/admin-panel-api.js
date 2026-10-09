import { creerCompte as creerCompteSb, reinitialiserMotDePasse as resetMdpSb } from "../../../backend/account-manage-supabase";

// Gestion des comptes du panneau Admin (Edge Function account-manage).
// Lèvent une erreur explicite en cas d'échec ; la gestion d'état et des
// toasts reste dans useAdminPanel.

export function creerCompte({ schoolId, login, mdp, role, nom, label }) {
  return creerCompteSb({ schoolId, login, mdp, role, nom, label });
}

export function reinitialiserMotDePasse({ schoolId, accountId, mdp }) {
  return resetMdpSb({ schoolId, accountId, mdp });
}
