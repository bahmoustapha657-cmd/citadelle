// Accès données du module Communications superadmin : flux des messages,
// statistiques de lecture, envoi et suppression.
import * as sbMsg from "../../backend/superadmin-messages-supabase";

// S'abonne au flux des messages superadmin (du plus récent au plus ancien).
export function subscribeMessages(onData) {
  return sbMsg.subscribeMessages(onData);
}

// Agrège, par message, le nombre de lectures et d'écoles distinctes.
export function fetchStatsLectures(messages) {
  return sbMsg.fetchStatsLectures(messages);
}

// Crée un nouveau message superadmin.
export function envoyerMessage({ titre, corps, niveau, cibleSchools, cibleRoles, auteur }) {
  return sbMsg.envoyerMessage({ titre, corps, niveau, cibleSchools, cibleRoles, auteur });
}

// Supprime un message superadmin.
export function supprimerMessageApi(id) {
  return sbMsg.supprimerMessageApi(id);
}
