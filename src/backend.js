// ── Choix du backend de données / auth ──────────────────────────────────────
// Par défaut "firebase" → la prod reste strictement inchangée. Pour tester la
// version Supabase en local, mettre dans .env(.local) : VITE_BACKEND=supabase
// (+ VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY).
export const BACKEND = String(import.meta.env.VITE_BACKEND || "firebase").trim().toLowerCase();
export const isSupabase = BACKEND === "supabase";

// Domaine e-mail INTERNE de connexion (jamais une vraie adresse) — identique à
// la prod Firebase et au build Supabase. Voir aussi supabase/_brand.mjs.
export const AUTH_EMAIL_DOMAIN = "edugest.app";
export const emailFor = (login, code) => `${String(login).trim().toLowerCase()}.${code}@${AUTH_EMAIL_DOMAIN}`;
export const superadminEmailFor = (login) => `${String(login).trim().toLowerCase()}@superadmin.${AUTH_EMAIL_DOMAIN}`;
