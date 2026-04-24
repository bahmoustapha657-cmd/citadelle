import { extractAccountProfileFields } from "./account-links.js";

export function buildUserProfilePayload({
  account = {},
  schoolId,
  login,
  email,
  compteDocId,
}) {
  const profileFields = extractAccountProfileFields(account);

  return {
    schoolId,
    role: account.role,
    nom: account.nom || login,
    label: account.label || account.role,
    login,
    email,
    compteDocId,
    premiereCo: !!account.premiereCo,
    statut: account.statut || "Actif",
    ...profileFields,
    updatedAt: Date.now(),
  };
}

export function buildSessionAccountPayload(account = {}, login = "") {
  const profileFields = extractAccountProfileFields(account);

  return {
    login: account.login || login,
    role: account.role,
    nom: account.nom || login,
    label: account.label || account.role,
    ...profileFields,
  };
}
