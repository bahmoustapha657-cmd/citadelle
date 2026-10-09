// Accès réseau de la connexion : résolution de l'état d'une école et appels
// d'authentification (superadmin + école standard).
import * as sbAuth from "../../backend/auth-supabase";

// Lookup de l'état d'une école → { info, statut }.
// statut ∈ "" (ok), "supprimee", "inactive" ; info=null si indisponible.
export function fetchEtatEcole(sid) {
  return sbAuth.fetchEtatEcole(sid);
}

// Authentification superadmin.
export function superadminLogin({ login, mdp }) {
  return sbAuth.superadminLogin({ login, mdp });
}

// Authentification d'un utilisateur d'école.
export function ecoleLogin({ login, mdp, schoolId }) {
  return sbAuth.ecoleLogin({ login, mdp, schoolId });
}
