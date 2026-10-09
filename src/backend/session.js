// Fin de session (déconnexion), point d'entrée unique de l'app.
import { signOut } from "./auth-supabase";

export function signOutSession() {
  return signOut();
}
