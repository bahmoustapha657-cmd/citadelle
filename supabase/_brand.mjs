// Marque de l'application : EduGest (Firebase ET Supabase — marque unifiée).
// Le domaine e-mail ci-dessous est un IDENTIFIANT INTERNE de connexion
// (jamais une vraie adresse) : login.codeEcole@edugest.app. Identique au
// domaine interne de la prod Firebase → système unifié.
export const APP_NAME = "EduGest";
export const AUTH_EMAIL_DOMAIN = "edugest.app";
export const emailFor = (login, code) => `${login}.${code}@${AUTH_EMAIL_DOMAIN}`;
// Le superadmin est transversal (pas de code école) : domaine dédié.
export const superadminEmailFor = (login) => `${login}@superadmin.${AUTH_EMAIL_DOMAIN}`;
