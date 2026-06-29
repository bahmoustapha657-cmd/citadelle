// Accès réseau du portail parent (/parent-portal) : chargement des données
// et envoi d'un message. Normalisent les réponses ou lèvent une erreur.
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { isSupabase } from "../../backend";
import * as sbParent from "../../backend/parent-portal-supabase";

// Charge les données du portail et renvoie un portalData normalisé (tableaux).
export async function fetchParentPortal() {
  if (isSupabase) return sbParent.fetchParentPortal();
  const headers = await getAuthHeaders();
  const res = await apiFetch("/parent-portal", { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Chargement impossible.");
  }
  return {
    eleves: Array.isArray(data.eleves) ? data.eleves : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    absences: Array.isArray(data.absences) ? data.absences : [],
    messages: Array.isArray(data.messages) ? data.messages : [],
    tarifs: Array.isArray(data.tarifs) ? data.tarifs : [],
    annonces: Array.isArray(data.annonces) ? data.annonces : [],
  };
}

// Envoie un message au nom du parent pour l'élève courant.
export async function envoyerMessageParent({ eleveId, sujet, corps }) {
  if (isSupabase) return sbParent.envoyerMessageParent({ eleveId, sujet, corps });
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await apiFetch("/parent-portal", {
    method: "POST",
    headers,
    body: JSON.stringify({ eleveId, sujet, corps }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Envoi impossible.");
  }
  return data;
}
