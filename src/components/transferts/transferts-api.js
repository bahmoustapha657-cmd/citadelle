// Transferts d'élèves entre écoles : génération du jeton, vérification,
// acceptation. Façade sans logique depuis le retrait du chemin /transfert
// (liquidation Firebase, lot 6). La gestion d'état et des toasts reste dans
// useTransferts.
export {
  apiGenererToken,
  apiVerifierToken,
  apiAccepterTransfert,
} from "../../backend/transferts-supabase";
