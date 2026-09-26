// ── Retour d'un lien « mot de passe oublié » : lecture de l'URL ─────────────
// Module PUR (aucun import Supabase ni import.meta.env) : testé tel quel par
// tests/password-reset.test.js.
//
// Trois formes possibles à l'arrivée sur l'app :
//   • #type=recovery&token_hash=…  — lien actuel, construit par l'Edge
//     Function password-reset. Le jeton n'est échangé contre une session
//     qu'au clic « Enregistrer » (verifyOtp), jamais au chargement ;
//   • ?recovery=1#access_token=…&refresh_token=…&type=recovery — anciens
//     liens passés par /auth/v1/verify, déjà envoyés ;
//   • ?recovery=1#error=access_denied&error_code=otp_expired&… — Supabase
//     Auth a refusé l'ancien lien (expiré, déjà utilisé) : on l'annonce au
//     lieu d'afficher l'accueil sans explication.
export function analyserRetourRecovery({ hash = "", search = "" } = {}) {
  const fragment = new URLSearchParams(String(hash).replace(/^#/, ""));
  const requete = new URLSearchParams(String(search).replace(/^\?/, ""));
  const lire = (cle) => fragment.get(cle) || requete.get(cle) || "";

  if (lire("type") !== "recovery" && requete.get("recovery") !== "1") return null;

  const tokenHash = lire("token_hash");
  if (tokenHash) return { mode: "otp", tokenHash };

  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (accessToken && refreshToken) return { mode: "session", accessToken, refreshToken };

  return { mode: "erreur", code: lire("error_code") || lire("error") || "lien_incomplet" };
}

// Identifiant et code école du compte récupéré, rappelés après coup : qui a
// oublié son mot de passe a souvent oublié son identifiant aussi. Source :
// user_metadata posé à la création du compte, sinon l'e-mail interne
// {login}.{code}@… (le code école ne contient jamais de point).
export function identiteCompte(user) {
  const meta = user?.user_metadata || {};
  let login = String(meta.login || "").trim();
  let schoolId = String(meta.schoolId || "").trim();
  const local = String(user?.email || "").split("@")[0];
  const point = local.lastIndexOf(".");
  if (point > 0) {
    login = login || local.slice(0, point);
    schoolId = schoolId || local.slice(point + 1);
  }
  return { login, schoolId };
}

// Réseau coupé ou serveur momentanément indisponible (auth-js lève alors une
// AuthRetryableFetchError) : ni le lien ni le mot de passe ne sont en cause.
export function estErreurReseau(erreur) {
  return erreur?.name === "AuthRetryableFetchError" || erreur?.status === 0;
}

const MSG_RESEAU = "Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez.";

// Message affiché pour un refus de Supabase Auth. `etape` : "lien" (échange
// du jeton contre une session) ou "mdp" (enregistrement du mot de passe).
export function messageErreurRecovery(erreur, etape) {
  if (estErreurReseau(erreur)) return MSG_RESEAU;
  if (etape === "lien") {
    return "Ce lien de réinitialisation a expiré ou a déjà été utilisé. Refaites une demande depuis l'écran de connexion (« Mot de passe oublié ? »).";
  }
  const code = String(erreur?.code || "");
  if (code === "same_password") return "Choisissez un mot de passe différent de l'ancien.";
  if (code === "weak_password") return "Mot de passe trop faible : allongez-le et mélangez lettres et chiffres.";
  return `Impossible d'enregistrer le mot de passe${erreur?.message ? ` : ${erreur.message}` : "."}`;
}
