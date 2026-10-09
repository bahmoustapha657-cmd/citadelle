// Domaine e-mail INTERNE de connexion (jamais une vraie adresse). Voir aussi
// supabase/_brand.mjs.
export const AUTH_EMAIL_DOMAIN = "edugest.app";
export const emailFor = (login, code) => `${String(login).trim().toLowerCase()}.${code}@${AUTH_EMAIL_DOMAIN}`;
export const superadminEmailFor = (login) => `${String(login).trim().toLowerCase()}@superadmin.${AUTH_EMAIL_DOMAIN}`;
