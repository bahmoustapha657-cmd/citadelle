import {
  ADMIN_WRITABLE_MODULES,
  ROLE_IDS_PERSONNALISABLES,
  normalizeRoleLogin,
} from "../../../constants";

// Transformations pures du formulaire de configuration des rôles.
// Utilisées par useRolesConfig comme callbacks de setState.

// Toggle de la visibilité (lecture) d'un module pour un rôle. Retirer la
// lecture retire aussi l'écriture (pas d'écriture sans lecture).
export function applyModuleToggle(prev, role, moduleId) {
  const currentModules = prev[role]?.modules || [];
  const willInclude = !currentModules.includes(moduleId);
  const nextModules = willInclude
    ? [...currentModules, moduleId]
    : currentModules.filter((id) => id !== moduleId);
  const currentWrite = prev[role]?.writeModules || [];
  const nextWrite = willInclude
    ? currentWrite
    : currentWrite.filter((id) => id !== moduleId);
  return {
    ...prev,
    [role]: { ...prev[role], modules: nextModules, writeModules: nextWrite },
  };
}

// Toggle de l'écriture d'un module pour l'admin. N'a de sens que pour
// role==="admin" ET module dans ADMIN_WRITABLE_MODULES.
export function applyWriteToggle(prev, role, moduleId) {
  if (role !== "admin" || !ADMIN_WRITABLE_MODULES.includes(moduleId)) return prev;
  const currentWrite = prev[role]?.writeModules || [];
  const currentModules = prev[role]?.modules || [];
  // Garde-fou : impossible d'autoriser l'écriture sur un module pas visible.
  if (!currentModules.includes(moduleId)) return prev;
  const nextWrite = currentWrite.includes(moduleId)
    ? currentWrite.filter((id) => id !== moduleId)
    : [...currentWrite, moduleId];
  return { ...prev, [role]: { ...prev[role], writeModules: nextWrite } };
}

// Normalise les logins de chaque rôle personnalisable avant sauvegarde.
export function prepareRoleSettings(roleConfigForm) {
  return ROLE_IDS_PERSONNALISABLES.reduce((acc, role) => {
    const config = roleConfigForm[role];
    acc[role] = { ...config, login: normalizeRoleLogin(config?.login, role) };
    return acc;
  }, {});
}

// Retourne les logins en doublon parmi les comptes actifs (vide si aucun).
export function findDuplicateLogins(preparedRoleSettings) {
  const loginsActifs = Object.values(preparedRoleSettings)
    .filter((config) => config.active !== false)
    .map((config) => config.login);
  const doublons = loginsActifs.filter((login, index) => loginsActifs.indexOf(login) !== index);
  return [...new Set(doublons)];
}
