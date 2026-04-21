export const ROLE_ORDER = ["direction", "admin", "comptable", "primaire", "college"];

export const ROLE_MODULE_CAPABILITIES = {
  superadmin: ["superadmin_panel"],
  admin: ["accueil", "historique", "admin_panel", "parametres", "fondation", "compta", "primaire", "secondaire", "calendrier", "examens", "messages"],
  direction: ["accueil", "historique", "admin_panel", "parametres", "fondation", "compta", "primaire", "secondaire", "calendrier", "examens", "messages"],
  primaire: ["primaire", "calendrier", "examens"],
  college: ["secondaire", "calendrier", "examens"],
  comptable: ["compta", "primaire", "secondaire", "calendrier", "examens"],
  enseignant: ["portail_enseignant"],
  parent: ["portail_parent"],
};

export const ROLE_REQUIRED_MODULES = {
  admin: ["admin_panel", "parametres"],
  direction: ["admin_panel", "parametres"],
};

export const ROLE_SETTINGS_DEFAULT = {
  direction: {
    role: "direction",
    nom: "Directeur General",
    login: "directeur",
    label: "Direction Generale",
    active: true,
    modules: ROLE_MODULE_CAPABILITIES.direction,
  },
  admin: {
    role: "admin",
    nom: "Administrateur",
    login: "admin",
    label: "Administrateur",
    active: true,
    modules: ROLE_MODULE_CAPABILITIES.admin,
  },
  comptable: {
    role: "comptable",
    nom: "Comptable",
    login: "comptable",
    label: "Comptabilite",
    active: true,
    modules: ROLE_MODULE_CAPABILITIES.comptable,
  },
  primaire: {
    role: "primaire",
    nom: "Direction Primaire",
    login: "primaire",
    label: "Direction Primaire",
    active: true,
    modules: ROLE_MODULE_CAPABILITIES.primaire,
  },
  college: {
    role: "college",
    nom: "Bureau College",
    login: "college",
    label: "Bureau College",
    active: true,
    modules: ROLE_MODULE_CAPABILITIES.college,
  },
};

function dedupe(list = []) {
  return [...new Set(list)];
}

function sanitizeText(value, fallback, maxLength = 80) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text.slice(0, maxLength);
}

export function normalizeRoleLogin(value, fallback = "compte") {
  const text = typeof value === "string" ? value : "";
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-._]{2,}/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 30);

  return normalized.length >= 3 ? normalized : fallback;
}

function normalizeModules(role, requestedModules, active) {
  const allowedModules = ROLE_MODULE_CAPABILITIES[role] || [];
  const requiredModules = ROLE_REQUIRED_MODULES[role] || [];
  const requested = Array.isArray(requestedModules) ? requestedModules.filter((moduleId) => allowedModules.includes(moduleId)) : [];
  const merged = dedupe([...requiredModules, ...requested]);

  if (merged.length > 0) return merged;
  if (!active) return dedupe(requiredModules);
  return dedupe([...requiredModules, ...allowedModules]);
}

export function normalizeRoleSettings(rawSettings = {}) {
  return ROLE_ORDER.reduce((accumulator, role) => {
    const defaults = ROLE_SETTINGS_DEFAULT[role];
    const current = rawSettings?.[role] || {};
    const active = role === "direction" ? true : current.active !== false;
    accumulator[role] = {
      role,
      nom: sanitizeText(current.nom, defaults.nom),
      login: normalizeRoleLogin(current.login, defaults.login),
      label: sanitizeText(current.label, defaults.label),
      active,
      modules: normalizeModules(role, current.modules, active),
    };
    return accumulator;
  }, {});
}

export function getRoleSettingsMap(source = {}) {
  return normalizeRoleSettings(source?.roleSettings || source);
}

export function getRoleConfig(role, source = {}) {
  if (!ROLE_SETTINGS_DEFAULT[role]) {
    return {
      role,
      nom: role,
      login: role,
      label: role,
      active: true,
      modules: ROLE_MODULE_CAPABILITIES[role] || [],
    };
  }
  return getRoleSettingsMap(source)[role];
}

export function getRoleLabel(role, source = {}) {
  return getRoleConfig(role, source).label;
}

export function getRoleModules(role, source = {}) {
  if (!ROLE_SETTINGS_DEFAULT[role]) return ROLE_MODULE_CAPABILITIES[role] || [];
  return getRoleConfig(role, source).modules;
}

export function getPrimaryModuleForRole(role, source = {}) {
  const modules = getRoleModules(role, source);
  return modules[0] || null;
}

export function getActiveRoleAccounts(source = {}) {
  const settings = getRoleSettingsMap(source);
  return ROLE_ORDER
    .map((role) => settings[role])
    .filter((config) => config.active)
    .map((config) => ({
      id: config.role,
      role: config.role,
      nom: config.nom,
      login: config.login,
      label: config.label,
      active: config.active,
      modules: [...config.modules],
    }));
}
