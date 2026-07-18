import {
  ADMIN_WRITABLE_MODULES,
  MODULE_COLLECTIONS,
  ROLE_ORDER,
  ROLE_MODULE_CAPABILITIES,
  ROLE_SETTINGS_DEFAULT,
  getActiveRoleAccounts,
  getAdminWriteModules,
  getPrimaryModuleForRole as getPrimaryModuleForRoleConfig,
  getRoleConfig as getRoleConfigFromSettings,
  getRoleLabel as getRoleLabelFromSettings,
  getRoleModules as getRoleModulesFromSettings,
  getRoleSettingsMap,
  normalizeRoleLogin,
} from "../shared/role-config.js";

export { ADMIN_WRITABLE_MODULES, MODULE_COLLECTIONS, getAdminWriteModules };

// Couleurs marque/UI. `blue`/`blueDark` restent la couleur marque
// littérale (utilisée à la fois comme texte et comme background dans
// des avatars/boutons/badges) — ne pas la dérouter vers une variable
// thème car ça casserait les fonds bleus en mode sombre.
// Le mode sombre utilise plutôt les règles CSS catch-all dans index.css
// pour remapper les couleurs textes vers --lc-text quand elles
// apparaissent sur un fond clair surchargé.
export const C = {
  blue: "#0A1628",
  blueDark: "#0A1628",
  green: "#00C48C",
  greenDk: "#00A876",
  gold: "#FFB547",
  white: "#ffffff",
  bg: "var(--lc-bg, #EEF2F7)",
  sidebar: "#0A1628",
};

export const TOUS_MOIS_COURTS = ["Sep", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû"];
export const TOUS_MOIS_LONGS = ["Septembre", "Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août"];
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

// ── Systèmes de classes (adaptabilité par école) ────────────────
// Le système choisi dans Paramètres → Identité détermine les listes de
// classes PROPOSÉES (pastilles, sélecteurs, import). La détection de
// section (getSectionForClasse) et la promotion (classeSuivante)
// reconnaissent les DEUX nomenclatures par motif, indépendamment du
// réglage — une école qui mélange les noms reste cohérente.
// 4 divisions (A→D) par niveau ; la saisie libre couvre au-delà.
const DIVISIONS_NIVEAU = ["A", "B", "C", "D"];
const genClasses = (niveaux) =>
  niveaux.flatMap((niveau) => DIVISIONS_NIVEAU.map((division) => `${niveau} ${division}`));

const NIVEAUX_PAR_SYSTEME = {
  guineen: {
    primaire: ["Maternelle", "1ère Année", "2ème Année", "3ème Année", "4ème Année", "5ème Année", "6ème Année"],
    college: ["7ème Année", "8ème Année", "9ème Année", "10ème Année"],
    lycee: ["11ème Année", "12ème Année", "Terminale"],
  },
  francophone: {
    primaire: ["Petite Section", "Moyenne Section", "Grande Section", "CP", "CE1", "CE2", "CM1", "CM2"],
    college: ["6ème", "5ème", "4ème", "3ème"],
    lycee: ["Seconde", "Première", "Terminale"],
  },
};

export const SYSTEMES_SCOLAIRES = [
  { id: "guineen", label: "Système guinéen — 1ère à 12ème Année, Terminale" },
  { id: "francophone", label: "Système francophone — CP à CM2, 6ème à 3ème, Seconde à Terminale" },
];

export const getSystemeScolaire = (schoolInfo = {}) =>
  (NIVEAUX_PAR_SYSTEME[schoolInfo.systemeScolaire] ? schoolInfo.systemeScolaire : "guineen");

// ── Sections réellement ouvertes dans l'école ───────────────────────────────
// Une école sans lycée (ou primaire seul) le déclare dans Paramètres →
// Identité ; l'UI (onglets Secondaire, sélecteurs) suit. Défaut : tout.
export const SECTIONS_ECOLE = ["primaire", "college", "lycee"];
export const getSectionsActives = (schoolInfo = {}) => {
  const brut = Array.isArray(schoolInfo.sectionsActives)
    ? schoolInfo.sectionsActives.filter((s) => SECTIONS_ECOLE.includes(s)) : [];
  return brut.length ? brut : [...SECTIONS_ECOLE];
};
export const isSectionActive = (schoolInfo, section) => getSectionsActives(schoolInfo).includes(section);

// Exports historiques (système guinéen) — conservés pour compat.
export const CLASSES_PRIMAIRE = genClasses(NIVEAUX_PAR_SYSTEME.guineen.primaire);
export const CLASSES_COLLEGE = genClasses(NIVEAUX_PAR_SYSTEME.guineen.college);
export const CLASSES_LYCEE = genClasses(NIVEAUX_PAR_SYSTEME.guineen.lycee);

// Toutes les classes connues, tous systèmes confondus (import Excel…).
export const getToutesClassesConnues = () =>
  Object.values(NIVEAUX_PAR_SYSTEME).flatMap((systeme) =>
    ["primaire", "college", "lycee"].flatMap((section) => genClasses(systeme[section])));

export const MATIERES_PRIMAIRE = [
  "Calcul", "Écriture", "Lecture", "Histoire", "Géographie",
  "Éducation Civique et Morale", "Récitation et Chant", "Langage",
  "Sciences d'Observation", "Éducation Physique",
].map((nom) => ({ nom, coefficient: 1 }));

export const TOUTES_ANNEES = Array.from({ length: 30 }, (_, index) => `${2025 + index}-${2026 + index}`);
export const MENSUALITE = { college: 150000, lycee: 150000, primaire: 120000 };
export const initMens = () => MOIS_ANNEE.reduce((accumulator, mois) => ({ ...accumulator, [mois]: "Impayé" }), {});

// Détection de section par MOTIF (et non par correspondance exacte avec
// les listes prédéfinies) : une classe saisie librement (« 3ème Année E »,
// « CM2 Rouge ») est rattachée à la bonne section quel que soit son
// suffixe. Les DEUX nomenclatures sont reconnues :
//  - guinéenne : « Nème Année » (1-6 primaire, 7-10 collège, 11-12 lycée)
//  - francophone : Petite/Moyenne/Grande Section, CP, CE1-2, CM1-2
//    (primaire) ; 6ème-3ème SANS « Année » (collège) ; Seconde, Première
//    (lycée). « 1ère Année » (guinéen, primaire) ≠ « 1ère » seule
//    (Première, lycée) — le mot « Année » discrimine.
// Repli sur les listes pour les noms hors motif.
const RE_CLASSE_ANNEE = /^\s*(\d+)\s*(?:ère|ere|ème|eme|e)?\s*ann[ée]e\b/i;
export const getSectionForClasse = (classe = "") => {
  const c = String(classe || "");
  if (/^\s*maternelle\b/i.test(c)) return "primaire";
  if (/^\s*terminale\b/i.test(c)) return "lycee";
  const m = c.match(RE_CLASSE_ANNEE);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 6) return "primaire";
    if (n >= 11) return "lycee";
    return "college";
  }
  // Système francophone (le motif « Année » a déjà été traité ci-dessus)
  if (/^\s*(petite|moyenne|grande)\s+section\b/i.test(c)) return "primaire";
  if (/^\s*(cp|ce\s*[12]|cm\s*[12])\b/i.test(c)) return "primaire";
  if (/^\s*(seconde|2nde|premi[èe]re|1\s*[èe]re)\b/i.test(c)) return "lycee";
  if (/^\s*[3-6]\s*(?:ème|eme|e)\b/i.test(c)) return "college";
  if (CLASSES_PRIMAIRE.includes(c)) return "primaire";
  if (CLASSES_LYCEE.includes(c)) return "lycee";
  return "college";
};

export const getSectionLabel = (section = "college") => (
  section === "primaire" ? "Primaire" : section === "lycee" ? "Lycée" : "Collège"
);

export const getSectionLabelForClasse = (classe = "") => getSectionLabel(getSectionForClasse(classe));

// Listes proposées pour une section, selon le système de l'école
// (2e argument : id du système, ex. getSystemeScolaire(schoolInfo)).
export const getClassesForSection = (section = "college", systeme = "guineen") => {
  const niveaux = NIVEAUX_PAR_SYSTEME[systeme] || NIVEAUX_PAR_SYSTEME.guineen;
  return genClasses(
    section === "primaire" ? niveaux.primaire : section === "lycee" ? niveaux.lycee : niveaux.college,
  );
};

export const getDefaultMensualiteForClasse = (classe = "") => {
  const section = getSectionForClasse(classe);
  return MENSUALITE[section] ?? MENSUALITE.college;
};

export const getTarifRevisionValue = (tarif = {}) => Number(tarif?.revision || 0);

export const getTarifAutreValue = (tarif = {}) => Number(tarif?.autre || 0);

export const getTarifMensuelTotal = (tarif = null, classe = "") => {
  const montantBase = tarif ? Number(tarif?.montant || 0) : getDefaultMensualiteForClasse(classe);
  return montantBase + getTarifRevisionValue(tarif);
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

// Monnaie courante (mise à jour depuis App.jsx via setMonnaie) — défaut "GNF".
// Variable module-level pour que fmt() reste appelable sans args partout (~23 sites).
export const MONNAIES = ["GNF","XOF","XAF","USD","EUR","MAD"];
let _monnaieCourante = "GNF";
export const setMonnaie = (m) => { _monnaieCourante = (typeof m === "string" && m.trim()) || "GNF"; };
export const getMonnaie = () => _monnaieCourante;
export const fmt = (nombre, monnaie) => `${Number(nombre || 0).toLocaleString("fr-FR")} ${monnaie || _monnaieCourante}`;
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
// Création de comptes parents : direction + admin (gestion globale) +
// comptable (en première ligne sur l'inscription/paiement, c'est lui
// qui ouvre l'accès parent en pratique).
export const peutCreerComptesParent = (role) => role === "direction" || role === "admin" || role === "comptable";

export const MODULES = [
  { id: "superadmin_panel", label: "Super Admin", icon: "⚙️", desc: "Gestion des écoles" },
  { id: "accueil", label: "Tableau de bord", icon: "📈", desc: "Vue d'ensemble" },
  { id: "historique", label: "Historique", icon: "📋", desc: "Journal des actions" },
  { id: "admin_panel", label: "Comptes & Postes", icon: "🧩", desc: "Comptes, droits et signataires" },
  { id: "parametres", label: "Paramètres", icon: "🏫", desc: "Identité de l'école" },
  { id: "fondation", label: "Fondation", icon: "🏛️", desc: "Gouvernance" },
  { id: "compta", label: "Comptabilité", icon: "📊", desc: "Finances" },
  { id: "primaire", label: "Dir. Primaire", icon: "🎒", desc: "Primaire" },
  { id: "secondaire", label: "Secondaire", icon: "🏫", desc: "Bureau Collège" },
  { id: "calendrier", label: "Calendrier", icon: "📅", desc: "Événements scolaires" },
  { id: "examens", label: "Examens", icon: "📝", desc: "Planning & convocations" },
  { id: "portail_enseignant", label: "Mon Espace", icon: "👨‍🏫", desc: "Portail enseignant" },
  { id: "portail_parent", label: "Espace Parent", icon: "👨‍👩‍👧", desc: "Suivi de mon enfant" },
  { id: "messages", label: "Messages Parents", icon: "💬", desc: "Liaison école-famille" },
];

export const getModuleOptionsForRole = (role) => {
  const allowedModules = ACCES[role] || [];
  return MODULES.filter((module) => allowedModules.includes(module.id));
};
