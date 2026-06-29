// Aiguillage des opérations de session selon le backend actif (VITE_BACKEND).
// Garde la prod Firebase strictement inchangée par défaut.
import { isSupabase } from "../backend";
import { signOutCurrentUser } from "../firebaseAuth";
import { signOut as signOutSupabase } from "./auth-supabase";

export function signOutSession() {
  return isSupabase ? signOutSupabase() : signOutCurrentUser();
}
