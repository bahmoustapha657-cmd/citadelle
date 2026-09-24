// Création de compte et réinitialisation de mot de passe, côté panneau Admin.
// Façade sans logique depuis le retrait du chemin /account-manage (liquidation
// Firebase, lot 6) : ces opérations touchent l'authentification, elles passent
// donc par l'Edge Function `account-manage` et non par le client.
// Elles lèvent en cas d'échec ; l'état et les toasts restent dans useAdminPanel.
export {
  creerCompte,
  reinitialiserMotDePasse,
} from "../../../backend/account-manage-supabase";
