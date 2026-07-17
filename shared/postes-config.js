// ════════════════════════════════════════════════════════════════════════
//  EduGest — Postes flexibles : permissions par module (miroir de postes.sql)
// ════════════════════════════════════════════════════════════════════════
// Un POSTE est défini par l'école (label libre) et porte une carte de
// permissions { module: "lecture" | "ecriture" } ; module absent = invisible.
// Chaque compte du personnel pointe un poste (comptes.poste_id) ; plusieurs
// comptes peuvent partager le même poste. Les comptes SANS poste (legacy)
// retombent sur les capacités historiques de leur rôle enum — ce repli DOIT
// rester aligné sur my_permissions() dans supabase/postes.sql.
import {
  ROLE_SETTINGS_DEFAULT,
  getRoleModules,
  getAdminWriteModules,
} from "./role-config.js";

// Modules permissibles (MODULES de constants.js, hors portails et superadmin).
export const MODULES_PERMISSIBLES = [
  "accueil", "historique", "admin_panel", "parametres", "compta",
  "primaire", "secondaire", "calendrier", "examens", "messages", "fondation",
];

export const PERMISSION_LEVELS = ["lecture", "ecriture"];

// Tous droits — permissions de la direction (et du superadmin).
export const FULL_PERMISSIONS = Object.freeze(
  MODULES_PERMISSIBLES.reduce((acc, moduleId) => ({ ...acc, [moduleId]: "ecriture" }), {}),
);

// Ne garde que les modules connus et les niveaux valides.
export function normalizePermissions(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return MODULES_PERMISSIBLES.reduce((acc, moduleId) => {
    const level = source[moduleId];
    if (PERMISSION_LEVELS.includes(level)) acc[moduleId] = level;
    return acc;
  }, {});
}

export const hasRead = (permissions = {}, moduleId) =>
  permissions?.[moduleId] === "lecture" || permissions?.[moduleId] === "ecriture";

export const hasWrite = (permissions = {}, moduleId) =>
  permissions?.[moduleId] === "ecriture";

export const readableModules = (permissions = {}) =>
  MODULES_PERMISSIBLES.filter((moduleId) => hasRead(permissions, moduleId));

// ── Repli legacy (comptes sans poste_id) ────────────────────────────────────
// Reproduit les capacités effectives de l'interface historique : modules
// visibles = lecture ; écriture selon les prédicats codés en dur d'origine.
// ⚠️ Aligné sur le CASE de my_permissions() (supabase/postes.sql) — le SQL
// donne à l'admin l'écriture DB large (l'UI restait l'arbitre writeModules) ;
// ici on reflète le comportement UI exact pour ne rien changer à l'écran.
export function legacyPermissionsForRole(role, schoolInfo = {}) {
  if (role === "direction" || role === "superadmin") return { ...FULL_PERMISSIONS };
  if (!ROLE_SETTINGS_DEFAULT[role]) return {};

  const visibles = getRoleModules(role, schoolInfo);
  const ecriture = new Set();
  if (role === "admin") {
    getAdminWriteModules(schoolInfo).forEach((moduleId) => ecriture.add(moduleId));
    // admin_panel/parametres : gestion des comptes et réglages (comportement actuel).
    ecriture.add("admin_panel");
    ecriture.add("parametres");
  }
  if (role === "comptable") ecriture.add("compta");
  if (role === "surveillant") ["primaire", "secondaire", "calendrier"].forEach((m) => ecriture.add(m));
  if (role === "primaire") ["primaire", "calendrier", "examens"].forEach((m) => ecriture.add(m));
  if (role === "college") ["secondaire", "calendrier", "examens"].forEach((m) => ecriture.add(m));

  return normalizePermissions(visibles.reduce((acc, moduleId) => {
    acc[moduleId] = ecriture.has(moduleId) ? "ecriture" : "lecture";
    return acc;
  }, {}));
}

// Permissions effectives d'un compte de session : poste s'il existe (les
// permissions jointes par chargerCompte), sinon repli legacy sur le rôle.
export function getSessionPermissions(compte = {}, schoolInfo = {}) {
  if (compte.permissions && typeof compte.permissions === "object") {
    return normalizePermissions(compte.permissions);
  }
  return legacyPermissionsForRole(compte.role, schoolInfo);
}

// ── Gabarits de postes par défaut (bootstrap nouvelles écoles + migration) ──
// Dérivés des 6 rôles historiques : mêmes clés, mêmes logins par défaut.
export const DEFAULT_POSTES = Object.freeze(
  Object.values(ROLE_SETTINGS_DEFAULT).map((config) => ({
    cle: config.role,
    label: config.label,
    systeme: true,
    actif: true,
    loginDefaut: config.login,
    nomDefaut: config.nom,
    permissions: legacyPermissionsForRole(config.role, {}),
  })),
);

export function getDefaultPoste(cle) {
  return DEFAULT_POSTES.find((poste) => poste.cle === cle) || null;
}

// Rôles hors du système de postes (portails dédiés + superadmin).
export const ROLES_HORS_POSTES = ["superadmin", "enseignant", "parent"];

// Module d'atterrissage d'un compte du personnel (null pour les rôles hors
// postes — l'appelant retombe sur getPrimaryModuleForRole legacy).
export function getPrimaryModuleForCompte(compte = {}, schoolInfo = {}) {
  if (ROLES_HORS_POSTES.includes(compte.role)) return null;
  return readableModules(getSessionPermissions(compte, schoolInfo))[0] || null;
}
