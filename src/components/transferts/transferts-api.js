import { apiFetch, getAuthHeaders } from "../../apiClient";
import { isSupabase } from "../../backend";
import * as sbTransferts from "../../backend/transferts-supabase";

// Appels réseau de l'endpoint /transfert. Chaque fonction renvoie le JSON
// décodé ; la gestion d'état et des toasts reste dans useTransferts.

export async function apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination }) {
  if (isSupabase) return sbTransferts.apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination });
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await apiFetch("/transfert", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "generer", schoolId, eleveSnapshot, ecoleDestination }),
  });
  return res.json();
}

export async function apiVerifierToken(token) {
  if (isSupabase) return sbTransferts.apiVerifierToken(token);
  const headers = await getAuthHeaders({});
  const res = await apiFetch("/transfert", { headers, query: { token } });
  return res.json();
}

export async function apiAccepterTransfert({ token, targetSchoolId }) {
  if (isSupabase) return sbTransferts.apiAccepterTransfert({ token, targetSchoolId });
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await apiFetch("/transfert", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "accepter", token, targetSchoolId }),
  });
  return res.json();
}
