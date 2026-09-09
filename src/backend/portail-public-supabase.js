// ── Vitrine publique (écran pré-connexion) ──────────────────────────────────
// Le visiteur n'est PAS authentifié : il ne peut donc lire aucune table
// directement (la RLS des annonces est réservée au personnel). On passe par une
// RPC SECURITY DEFINER qui n'expose que les annonces marquées « publique »,
// sur le modèle d'`etat_ecole` déjà utilisé par l'écran de connexion.
// Voir supabase/portail-public.sql.
import { getSupabase } from "../supabaseClient";

// Renvoie les annonces publiques d'une école, au format attendu par les écrans
// (mêmes champs qu'une annonce lue par le personnel : { _id, ...extra }).
// Tableau vide en cas d'échec : une vitrine sans annonces reste consultable,
// alors qu'une erreur non gérée masquerait toute la page.
export async function fetchAnnoncesPubliques(schoolCode) {
  if (!schoolCode) return [];
  try {
    const { data, error } = await getSupabase().rpc("annonces_publiques", { p_code: schoolCode });
    if (error) {
      // Cas attendu tant que portail-public.sql n'a pas été appliqué : la
      // fonction n'existe pas encore. La page s'affiche sans ses annonces.
      console.warn("[vitrine] annonces publiques indisponibles :", error.message);
      return [];
    }
    return (data || []).map((r) => ({ _id: r.id, ...(r.extra || {}) }));
  } catch (e) {
    console.warn("[vitrine] annonces publiques indisponibles :", e?.message || e);
    return [];
  }
}
