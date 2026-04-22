import {
  ROLE_ORDER,
  ROLE_MODULE_CAPABILITIES,
  ROLE_SETTINGS_DEFAULT,
  getActiveRoleAccounts,
  getPrimaryModuleForRole as getPrimaryModuleForRoleConfig,
  getRoleConfig as getRoleConfigFromSettings,
  getRoleLabel as getRoleLabelFromSettings,
  getRoleModules as getRoleModulesFromSettings,
  getRoleSettingsMap,
  normalizeRoleLogin,
} from "../shared/role-config.js";

export const C = {
  blue: "#0A1628",
  blueDark: "#0A1628",
  green: "#00C48C",
  greenDk: "#00A876",
  gold: "#FFB547",
  white: "#ffffff",
  bg: "#EEF2F7",
  sidebar: "#0A1628",
};

export const TOUS_MOIS_COURTS = ["Sep", "Oct", "Nov", "DÃ©c", "Jan", "FÃ©v", "Mar", "Avr", "Mai", "Jun", "Jul", "AoÃ»"];
export const TOUS_MOIS_LONGS = ["Septembre", "Octobre", "Novembre", "DÃ©cembre", "Janvier", "FÃ©vrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "AoÃ»t"];
export const MOIS_ANNEE = TOUS_MOIS_COURTS.slice(1, 10);
export const MOIS_SALAIRE = TOUS_MOIS_LONGS.slice(1, 10);
export const calcMoisAnnee = (debut = "Octobre") => {
  const index = TOUS_MOIS_LONGS.indexOf(debut);
  return Array.from({ length: 9 }, (_, offset) => TOUS_MOIS_COURTS[(index + offset) % 12]);
};
export const calcMoisSalaire = (debut = "Octobre") => {
  const index = TOUS_MOIS_LONGS.indexOf(debut);
  return Array.from({ length: 9 }, (_, offset) => TOUS_MOIS_LONGS[(index + offset) % 12]);
};
export const getAnnee = () => localStorage.getItem("LC_annee") || "2025-2026";

export const CLASSES_PRIMAIRE = [
  "Maternelle A", "Maternelle B",
  "1Ã¨re AnnÃ©e A", "1Ã¨re AnnÃ©e B",
  "2Ã¨me AnnÃ©e A", "2Ã¨me AnnÃ©e B",
  "3Ã¨me AnnÃ©e A", "3Ã¨me AnnÃ©e B",
  "4Ã¨me AnnÃ©e A", "4Ã¨me AnnÃ©e B",
  "5Ã¨me AnnÃ©e A", "5Ã¨me AnnÃ©e B",
  "6Ã¨me AnnÃ©e A", "6Ã¨me AnnÃ©e B",
];
export const CLASSES_COLLEGE = [
  "7Ã¨me AnnÃ©e A", "7Ã¨me AnnÃ©e B",
  "8Ã¨me AnnÃ©e A", "8Ã¨me AnnÃ©e B",
  "9Ã¨me AnnÃ©e A", "9Ã¨me AnnÃ©e B",
  "10Ã¨me AnnÃ©e A", "10Ã¨me AnnÃ©e B",
];
export const CLASSES_LYCEE = [
  "11Ã¨me AnnÃ©e A", "11Ã¨me AnnÃ©e B",
  "12Ã¨me AnnÃ©e A", "12Ã¨me AnnÃ©e B",
  "Terminale A", "Terminale B",
];

export const MATIERES_PRIMAIRE = [
  "Calcul", "Ã‰criture", "Lecture", "Histoire", "GÃ©ographie",
  "Ã‰ducation Civique et Morale", "RÃ©citation et Chant", "Langage",
  "Sciences d'Observation", "Ã‰ducation Physique",
].map((nom) => ({ nom, coefficient: 1 }));

export const TOUTES_ANNEES = Array.from({ length: 30 }, (_, index) => `${2025 + index}-${2026 + index}`);
export const MENSUALITE = { college: 150000, lycee: 150000, primaire: 120000 };
export const initMens = () => MOIS_ANNEE.reduce((accumulator, mois) => ({ ...accumulator, [mois]: "ImpayÃ©" }), {});

export const getSectionForClasse = (classe = "") => {
  if (CLASSES_PRIMAIRE.includes(classe)) return "primaire";
  if (CLASSES_LYCEE.includes(classe)) return "lycee";
  return "college";
};

export const getSectionLabel = (section = "college") => (
  section === "primaire" ? "Primaire" : section === "lycee" ? "Lycée" : "Collège"
);

export const getSectionLabelForClasse = (classe = "") => getSectionLabel(getSectionForClasse(classe));

export const getClassesForSection = (section = "college") => (
  section === "primaire" ? CLASSES_PRIMAIRE : section === "lycee" ? CLASSES_LYCEE : CLASSES_COLLEGE
);

export const getDefaultMensualiteForClasse = (classe = "") => {
  const section = getSectionForClasse(classe);
  return MENSUALITE[section] ?? MENSUALITE.college;
};

export const genererMatricule = (eleves, type, config = {}) => {
  const anneeShort = getAnnee().split("-")[0].slice(-2);
  const anneeFull = getAnnee().split("-")[0];
  const prefixe = type === "primaire"
    ? (config.matriculePrefixPrim || "P")
    : type === "lycee"
      ? (config.matriculePrefixLyc || "L")
      : (config.matriculePrefixColl || "C");
  const separateur = config.matriculeSep != null ? config.matriculeSep : "-";
  const avecAnnee = config.matriculeAnnee !== false;
  const annee = avecAnnee ? (config.matriculeAnnee4 ? anneeFull : anneeShort) : "";
  const nombreChiffres = Number(config.matriculeChiffres || 3);
  const prefixeComplet = avecAnnee ? `${prefixe}${annee}${separateur}` : `${prefixe}${separateur}`;
  const numeros = eleves
    .map((eleve) => eleve.matricule || "")
    .filter((matricule) => matricule.startsWith(prefixeComplet))
    .map((matricule) => parseInt(matricule.replace(prefixeComplet, ""), 10) || 0);
  const suivant = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `${prefixeComplet}${String(suivant).padStart(nombreChiffres, "0")}`;
};

export const today = () => new Date().toLocaleDateString("fr-FR");
export const fmt = (nombre) => `${Number(nombre || 0).toLocaleString("fr-FR")} GNF`;
export const fmtN = (nombre) => Number(nombre || 0).toLocaleString("fr-FR");

export const ROLE_IDS_PERSONNALISABLES = ROLE_ORDER;
export const ROLE_SETTINGS_DEFAUTS = ROLE_SETTINGS_DEFAULT;
export const ACCES = ROLE_MODULE_CAPABILITIES;
export const COMPTES_DEFAUT = getActiveRoleAccounts({});
export const getRoleSettingsForSchool = (schoolInfo = {}) => getRoleSettingsMap(schoolInfo);
export const getRoleConfigForSchool = (role, schoolInfo = {}) => getRoleConfigFromSettings(role, schoolInfo);
export const getRoleLabelForSchool = (role, schoolInfo = {}) => getRoleLabelFromSettings(role, schoolInfo);
export const getModulesForRole = (role, schoolInfo = {}) => getRoleModulesFromSettings(role, schoolInfo);
export const getPrimaryModuleForRole = (role, schoolInfo = {}) => getPrimaryModuleForRoleConfig(role, schoolInfo);
export const getComptesDefautForSchool = (schoolInfo = {}) => getActiveRoleAccounts(schoolInfo);
export { normalizeRoleLogin };

export const genererMdp = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(12);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => chars[value % chars.length]).join("");
  }
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const PLANS = {
  gratuit: { label: "Gratuit", eleveLimit: 50, couleur: "#64748b", bg: "#f1f5f9" },
  starter: { label: "Starter", eleveLimit: 200, couleur: "#0ea5e9", bg: "#e0f2fe" },
  standard: { label: "Standard", eleveLimit: 500, couleur: "#8b5cf6", bg: "#ede9fe" },
  premium: { label: "Premium", eleveLimit: Infinity, couleur: "#f59e0b", bg: "#fef3c7" },
};
export const PLAN_DUREES = [
  { label: "1 mois", jours: 30 },
  { label: "3 mois", jours: 90 },
  { label: "6 mois", jours: 180 },
  { label: "1 an", jours: 365 },
];

export const peutModifierEleves = (role) => role === "comptable" || role === "admin" || role === "direction";
export const peutModifier = (role) => role === "admin" || role === "direction";

export const MODULES = [
  { id: "superadmin_panel", label: "Super Admin", icon: "âš™ï¸", desc: "Gestion des Ã©coles" },
  { id: "accueil", label: "Tableau de bord", icon: "ðŸ“ˆ", desc: "Vue d'ensemble" },
  { id: "historique", label: "Historique", icon: "ðŸ“‹", desc: "Journal des actions" },
  { id: "admin_panel", label: "Gestion AccÃ¨s", icon: "ðŸ”", desc: "Mots de passe" },
  { id: "parametres", label: "ParamÃ¨tres", icon: "ðŸ«", desc: "IdentitÃ© de l'Ã©cole" },
  { id: "fondation", label: "Fondation", icon: "ðŸ›ï¸", desc: "Gouvernance" },
  { id: "compta", label: "ComptabilitÃ©", icon: "ðŸ“Š", desc: "Finances" },
  { id: "primaire", label: "Dir. Primaire", icon: "ðŸŽ’", desc: "Primaire" },
  { id: "secondaire", label: "Secondaire", icon: "ðŸ«", desc: "Bureau CollÃ¨ge" },
  { id: "calendrier", label: "Calendrier", icon: "ðŸ“…", desc: "Ã‰vÃ©nements scolaires" },
  { id: "examens", label: "Examens", icon: "ðŸ“", desc: "Planning & convocations" },
  { id: "portail_enseignant", label: "Mon Espace", icon: "ðŸ‘¨â€ðŸ«", desc: "Portail enseignant" },
  { id: "portail_parent", label: "Espace Parent", icon: "ðŸ‘¨â€ðŸ‘©â€ðŸ‘§", desc: "Suivi de mon enfant" },
  { id: "messages", label: "Messages Parents", icon: "ðŸ’¬", desc: "Liaison Ã©cole-famille" },
];

export const getModuleOptionsForRole = (role) => {
  const allowedModules = ACCES[role] || [];
  return MODULES.filter((module) => allowedModules.includes(module.id));
};

