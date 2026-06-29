import { apiFetch, getAuthHeaders } from "../../apiClient";
import { isSupabase } from "../../backend";
import { fetchTeacherPortal as fetchTeacherPortalSupabase } from "../../backend/teacher-portal-supabase";

// Charge et normalise les données du portail enseignant via /teacher-portal.
// Renvoie un portalData complet (tableaux garantis) ou lève une erreur.
export async function fetchTeacherPortal(utilisateur) {
  if (isSupabase) return fetchTeacherPortalSupabase(utilisateur);
  // Identifiant de compte STABLE (≠ jeton qui tourne) : permet au service
  // worker d'isoler la réponse en cache par enseignant, pour qu'un appareil
  // partagé ne serve pas les données d'un collègue hors-ligne.
  const scope = utilisateur?.uid || utilisateur?.enseignantId || utilisateur?.login || "";
  const headers = await getAuthHeaders(scope ? { "X-Account-Scope": String(scope) } : {});
  const res = await apiFetch("/teacher-portal", { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Chargement impossible.");
  }
  return {
    section: data.section || utilisateur.section || "college",
    matieres: Array.isArray(data.matieres) ? data.matieres : [],
    emplois: Array.isArray(data.emplois) ? data.emplois : [],
    eleves: Array.isArray(data.eleves) ? data.eleves : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    enseignements: Array.isArray(data.enseignements) ? data.enseignements : [],
    salaires: Array.isArray(data.salaires) ? data.salaires : [],
    incidents: Array.isArray(data.incidents) ? data.incidents : [],
  };
}
