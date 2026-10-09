import { fetchTeacherPortal as fetchTeacherPortalSupabase } from "../../backend/teacher-portal-supabase";

// Charge et normalise les données du portail enseignant.
// Renvoie un portalData complet (tableaux garantis) ou lève une erreur.
// `opts.annee` : année des notes.
export function fetchTeacherPortal(utilisateur, opts = {}) {
  return fetchTeacherPortalSupabase(utilisateur, opts);
}
