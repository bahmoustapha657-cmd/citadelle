// ── Identités de connexion ──────────────────────────────────────────────────
// Le commutateur de backend (BACKEND / isSupabase) a disparu avec la
// liquidation Firebase (lot 6) : il n'y a plus qu'un seul backend, et chaque
// `if (isSupabase)` cachait un chemin mort que personne n'exécutait plus.
//
// Domaine e-mail INTERNE de connexion : ce n'est JAMAIS une vraie adresse. Les
// comptes d'école n'ont pas d'e-mail — on en fabrique un, stable et unique par
// (login, code école), parce que l'authentification en exige un.
// Voir aussi supabase/_brand.mjs, qui doit rester aligné.
export const AUTH_EMAIL_DOMAIN = "edugest.app";
export const emailFor = (login, code) => `${String(login).trim().toLowerCase()}.${code}@${AUTH_EMAIL_DOMAIN}`;
export const superadminEmailFor = (login) => `${String(login).trim().toLowerCase()}@superadmin.${AUTH_EMAIL_DOMAIN}`;
