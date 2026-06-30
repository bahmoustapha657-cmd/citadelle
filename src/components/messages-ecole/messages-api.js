import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebaseDb";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { isSupabase } from "../../backend";
import * as sbMsg from "../../backend/superadmin-messages-supabase";

// Récupère les messages SuperAdmin destinés à l'école (via /school).
// Renvoie toujours un tableau (vide en cas d'erreur).
export async function fetchSuperadminMessages() {
  if (isSupabase) return sbMsg.fetchSuperadminMessages();
  try {
    const headers = await getAuthHeaders();
    const response = await apiFetch("/school", { method: "GET", query: { op: "superadmin-messages" }, headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload.messages) ? payload.messages : [];
  } catch {
    return [];
  }
}

// Enregistre une lecture de message dans Firestore (best-effort).
export async function enregistrerLecture(msgId, { schoolId, role, login }, uid) {
  if (isSupabase) return sbMsg.enregistrerLecture(msgId, { schoolId, role, login });
  try {
    await setDoc(doc(db, "superadmin_messages", msgId, "lectures", uid), {
      schoolId,
      role,
      login: login || null,
      readAt: Date.now(),
    });
  } catch {
    // Pas d'accès réseau ou règles plus strictes : on garde le marquage local.
  }
}
