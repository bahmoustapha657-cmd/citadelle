// Fin de session (déconnexion), point d'entrée unique de l'app.
import { compterSaisiesNonEnvoyees, signOut } from "./auth-supabase";

export function signOutSession() {
  return signOut();
}

// Saisies de ce compte pas encore envoyées, à annoncer avant une
// déconnexion hors ligne (cf. use-app-shell.js).
export function saisiesNonEnvoyees() {
  return compterSaisiesNonEnvoyees();
}
