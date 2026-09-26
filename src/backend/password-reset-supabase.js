// ── Mot de passe oublié (Supabase) ──────────────────────────────────────────
// Demande publique (écran de connexion) → Edge Function `password-reset` qui
// décide : e-mail de réinitialisation (si e-mail réel + envoi configuré) ou
// notification à la Direction. Puis finalisation via le lien de récupération.
import { creerClientEphemere, getSupabase } from "../supabaseClient";
import { analyserRetourRecovery, estErreurReseau, identiteCompte, messageErreurRecovery } from "./recovery-url";

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

// Détecte un retour de lien de récupération (voir recovery-url.js).
// Le client est configuré avec detectSessionInUrl:false → on gère à la main.
export function lireRetourRecovery() {
  if (typeof window === "undefined") return null;
  return analyserRetourRecovery(window.location);
}

// Retire le jeton de la barre d'adresse (historique, favoris, partage
// d'écran) — une fois inutile seulement, voir use-recovery.js.
export function nettoyerUrlRecovery() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

// Enregistrement du nouveau mot de passe, sur un client jetable (la session
// de l'app n'est jamais touchée). Le lien n'est échangé contre une session
// qu'au premier appel, puis cette session sert aux essais suivants (appels
// simultanés compris) : un jeton ne sert qu'une fois, et un mot de passe
// refusé (trop faible, identique à l'ancien) ne doit pas griller le lien.
export function creerRecuperation(retour) {
  let session = null; // promesse de { client, user }

  const ouvrirSession = async () => {
    const c = creerClientEphemere();
    let reponse;
    try {
      reponse = retour.mode === "otp"
        ? await c.auth.verifyOtp({ type: "recovery", token_hash: retour.tokenHash })
        : await c.auth.setSession({ access_token: retour.accessToken, refresh_token: retour.refreshToken });
    } catch (e) {
      reponse = { error: e };
    }
    const { data, error } = reponse;
    if (error || !data?.user) {
      const refus = new Error(messageErreurRecovery(error, "lien"));
      refus.lienInvalide = !estErreurReseau(error);
      if (refus.lienInvalide) nettoyerUrlRecovery();
      throw refus;
    }
    return { client: c, user: data.user };
  };

  return {
    async enregistrer(nouveauMdp) {
      // Échec (réseau…) : le prochain essai retente l'échange du jeton.
      if (!session) session = ouvrirSession().catch((e) => { session = null; throw e; });
      const { client, user } = await session;
      const { error } = await client.auth.updateUser({ password: nouveauMdp });
      if (error) throw new Error(messageErreurRecovery(error, "mdp"));
      // Lever le drapeau première connexion (le mot de passe vient d'être choisi).
      try {
        await client.from("comptes").update({ premiere_co: false }).eq("user_id", user.id);
      } catch { /* non bloquant */ }
      try { await client.auth.signOut(); } catch { /* non bloquant */ }
      // Jeton consommé : un rechargement ne doit pas rouvrir le formulaire.
      nettoyerUrlRecovery();
      return identiteCompte(user);
    },
  };
}
