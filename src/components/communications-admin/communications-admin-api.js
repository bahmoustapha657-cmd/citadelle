// Module Communications du superadmin : flux des messages, statistiques de
// lecture, envoi et suppression. Façade sans logique depuis le retrait du
// chemin Firestore (liquidation Firebase, lot 5).
export {
  subscribeMessages,
  fetchStatsLectures,
  envoyerMessage,
  supprimerMessageApi,
} from "../../backend/superadmin-messages-supabase";
