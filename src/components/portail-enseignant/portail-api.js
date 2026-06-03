import { apiFetch, getAuthHeaders } from "../../apiClient";

// Charge et normalise les données du portail enseignant via /teacher-portal.
// Renvoie un portalData complet (tableaux garantis) ou lève une erreur.
export async function fetchTeacherPortal(utilisateur) {
  const headers = await getAuthHeaders();
  const res = await apiFetch("/teacher-portal", { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Chargement impossible.");
  }
  return {
    section: data.section || utilisateur.section || "college",
    emplois: Array.isArray(data.emplois) ? data.emplois : [],
    eleves: Array.isArray(data.eleves) ? data.eleves : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    enseignements: Array.isArray(data.enseignements) ? data.enseignements : [],
    salaires: Array.isArray(data.salaires) ? data.salaires : [],
    incidents: Array.isArray(data.incidents) ? data.incidents : [],
  };
}
