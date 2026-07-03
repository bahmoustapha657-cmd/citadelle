export const ROLE_ORDER = ["direction", "admin", "comptable", "surveillant", "primaire", "college"];

export const ROLE_MODULE_CAPABILITIES = {
  superadmin: ["superadmin_panel"],
  admin: ["accueil", "historique", "admin_panel", "parametres", "compta", "primaire", "secondaire", "calendrier", "examens", "messages"],
  direction: ["accueil", "historique", "admin_panel", "parametres", "fondation", "compta", "primaire", "secondaire", "calendrier", "examens", "messages"],
  primaire: ["primaire", "calendrier", "examens"],
  college: ["secondaire", "calendrier", "examens"],
  // Comptable : strictement limite a la Comptabilite. L'impression des listes
  // de classe se fait depuis l'onglet Inscriptions de la compta (EnrolToolbar),
  // pas via les modules pedagogiques.
  comptable: ["compta"],
  // Surveillant general : discipline/absences des DEUX sections. Il voit les
  // modules Primaire et Secondaire mais l'UI (Ecole.jsx) restreint ses onglets
  // a Eleves / Discipline / Emploi du temps — jamais notes, bulletins ni compta.
  surveillant: ["primaire", "secondaire", "calendrier"],
  enseignant: ["portail_enseignant"],
  parent: ["portail_parent"],
};

export const ROLE_REQUIRED_MODULES = {
  admin: ["admin_panel", "parametres"],
  direction: ["admin_panel", "parametres"],
};

// Modules dans lesquels le DG peut autoriser l'admin a ecrire. Les autres
// (compta, admin_panel, parametres, fondation, historique, accueil) restent
// en lecture stricte pour l'admin meme si actives dans roleSettings.modules.
// Ce sont les "modules systeme" : ecriture reservee aux roles direction /
// comptable / pedagogie pour empecher un admin de s'auto-promouvoir,
// d'effacer ses traces ou de manipuler la tresorerie via un client direct.
export const ADMIN_WRITABLE_MODULES = [
  "primaire",
  "secondaire",
  "calendrier",
  "examens",
  "messages",
];

// Mapping module -> collections Firestore. Sert a la fois aux rules
// (declenchement de canRead/canWrite par collection) et a la doc fonctionnelle
// du perimetre d'un module. Garder synchrone avec collectionsBackOffice() et
// les match /<collection>/ explicites de firestore.rules.
export const MODULE_COLLECTIONS = {
  primaire: [
    "elevesPrimaire",
    "classesPrimaire",
    "ensPrimaire",
    "ensPrimaire_enseignements",
    "classesPrimaire_emplois",
    "classesPrimaire_matieres",
    "notesPrimaire",
    "appreciationsPrimaire",
    "elevesPrimaire_absences",
  ],
  secondaire: [
    "elevesCollege",
    "elevesLycee",
    "classesCollege",
    "classesLycee",
    "ensCollege",
    "ensLycee",
    "ensCollege_enseignements",
    "ensLycee_enseignements",
    "classesCollege_emplois",
    "classesLycee_emplois",
    "classesCollege_matieres",
    "classesLycee_matieres",
    "notesCollege",
    "notesLycee",
    "appreciationsCollege",
    "appreciationsLycee",
    "elevesCollege_absences",
    "elevesLycee_absences",
  ],
  calendrier: ["evenements"],
  examens: ["examens", "livrets"],
  messages: ["messages"],
  compta: ["recettes", "depenses", "salaires", "bons", "personnel", "versements", "tarifs"],
  fondation: ["membres", "documents"],
  historique: ["historique"],
};

// Reverse-lookup utile aux rules et a l'UI : collection -> module proprietaire.
export const COLLECTION_TO_MODULE = Object.entries(MODULE_COLLECTIONS).reduce(
  (accumulator, [moduleId, collections]) => {
    for (const collection of collections) accumulator[collection] = moduleId;
    return accumulator;
  },
  {},
);

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
  surveillant: {
    role: "surveillant",
    nom: "Surveillant General",
    login: "surveillant",
    label: "Surveillance Generale",
    active: true,
    modules: ROLE_MODULE_CAPABILITIES.surveillant,
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

// writeModules est intentionnellement reserve au role admin : les autres roles
// systeme ont un perimetre d'ecriture deja code en dur dans les rules. On filtre
// strictement contre ADMIN_WRITABLE_MODULES + presence dans modules visibles
// (on ne peut pas ecrire dans un module qu'on ne voit pas).
function normalizeAdminWriteModules(role, requestedWriteModules, modules) {
  if (role !== "admin") return [];
  if (!Array.isArray(requestedWriteModules)) return [];
  return dedupe(
    requestedWriteModules.filter(
      (moduleId) => ADMIN_WRITABLE_MODULES.includes(moduleId) && modules.includes(moduleId),
    ),
  );
}

export function normalizeRoleSettings(rawSettings = {}) {
  return ROLE_ORDER.reduce((accumulator, role) => {
    const defaults = ROLE_SETTINGS_DEFAULT[role];
    const current = rawSettings?.[role] || {};
    const active = role === "direction" ? true : current.active !== false;
    const modules = normalizeModules(role, current.modules, active);
    accumulator[role] = {
      role,
      nom: sanitizeText(current.nom, defaults.nom),
      login: normalizeRoleLogin(current.login, defaults.login),
      label: sanitizeText(current.label, defaults.label),
      active,
      modules,
      writeModules: normalizeAdminWriteModules(role, current.writeModules, modules),
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

export function getAdminWriteModules(source = {}) {
  return getRoleConfig("admin", source).writeModules || [];
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
      writeModules: [...(config.writeModules || [])],
    }));
}
