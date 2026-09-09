// Connexion : résolution de l'état d'une école (avant authentification) et
// appels d'authentification (superadmin + école standard). Façade sans logique
// depuis le retrait du chemin Firestore/Vercel (liquidation Firebase, lot 5).
//
// La résolution d'école passe par la RPC etat_ecole (SECURITY DEFINER) : le
// visiteur n'étant pas encore authentifié, il ne peut lire aucune table.
export { fetchEtatEcole, superadminLogin, ecoleLogin } from "../../backend/auth-supabase";
