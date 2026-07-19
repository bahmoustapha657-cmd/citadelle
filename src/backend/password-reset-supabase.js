// ── Mot de passe oublié (Supabase) ──────────────────────────────────────────
// Demande publique (écran de connexion) → Edge Function `password-reset` qui
// décide : e-mail de réinitialisation (si e-mail réel + envoi configuré) ou
// notification à la Direction. Puis finalisation via le lien de récupération.
import { getSupabase } from "../supabaseClient";

// Déclenche la récupération. Réponse volontairement générique côté serveur.
export async function demanderReinitialisation({ schoolId, identifiant }) {
  const sb = getSupabase();
  const { data, error } = await sb.functions.invoke("password-reset", {
    body: { schoolId, identifiant },
  });
  if (error) {
    // On reste neutre : pas de détail qui permettrait l'énumération.
    return { ok: true, method: "generic" };
  }
  return data || { ok: true, method: "generic" };
}

// Détecte un retour de lien de récupération (jeton dans le hash de l'URL).
// Le client est configuré avec detectSessionInUrl:false → on gère à la main.
export function lireJetonRecovery() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash || "";
  const query = window.location.search || "";
  const estRecovery = hash.includes("type=recovery") || /[?&]recovery=1/.test(query);
  if (!estRecovery) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

// Ouvre la session de récupération à partir des jetons du lien.
export async function ouvrirSessionRecovery({ access_token, refresh_token }) {
  const sb = getSupabase();
  const { error } = await sb.auth.setSession({ access_token, refresh_token });
  if (error) throw new Error(error.message || "Lien de réinitialisation invalide ou expiré.");
  return { ok: true };
}

// Enregistre le nouveau mot de passe puis nettoie l'URL.
export async function finaliserReinitialisation(nouveauMdp) {
  const sb = getSupabase();
  const { error } = await sb.auth.updateUser({ password: nouveauMdp });
  if (error) throw new Error(error.message || "Impossible d'enregistrer le mot de passe.");
  // Lever le drapeau première connexion (le mot de passe vient d'être choisi).
  try {
    const { data: { user } } = await sb.auth.getUser();
    if (user) await sb.from("comptes").update({ premiere_co: false }).eq("user_id", user.id);
  } catch { /* non bloquant */ }
  try { await sb.auth.signOut(); } catch { /* non bloquant */ }
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return { ok: true };
}
