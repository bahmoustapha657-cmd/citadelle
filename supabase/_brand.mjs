// Marque de la version Supabase : GANDAL (ex-EduGest).
// Le domaine e-mail ci-dessous est un IDENTIFIANT INTERNE de connexion
// (jamais une vraie adresse) : login.codeEcole@gandal.app. Comme la migration
// recrée tous les comptes, on part directement sur @gandal.app — aucun impact
// sur la prod Firebase, qui garde son propre domaine interne.
export const APP_NAME = "GANDAL";
export const AUTH_EMAIL_DOMAIN = "gandal.app";
export const emailFor = (login, code) => `${login}.${code}@${AUTH_EMAIL_DOMAIN}`;
