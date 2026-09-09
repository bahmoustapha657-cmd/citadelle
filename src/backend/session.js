// Déconnexion. Façade conservée : les appelants n'ont pas à connaître le
// backend, et le jour où la session change de fournisseur, seul ce fichier
// bouge. Le chemin Firebase a disparu avec la liquidation (lot 5).
export { signOut as signOutSession } from "./auth-supabase";
