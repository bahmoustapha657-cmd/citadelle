import * as sbMsg from "../../backend/superadmin-messages-supabase";

// Récupère les messages SuperAdmin destinés à l'école.
// Renvoie toujours un tableau (vide en cas d'erreur).
export function fetchSuperadminMessages() {
  return sbMsg.fetchSuperadminMessages();
}

// Enregistre une lecture de message (best-effort).
export function enregistrerLecture(msgId, { schoolId, role, login }) {
  return sbMsg.enregistrerLecture(msgId, { schoolId, role, login });
}
