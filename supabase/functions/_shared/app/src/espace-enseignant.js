// GÉNÉRÉ par scripts/partager-edge.mjs depuis src/espace-enseignant.js — ne pas modifier ici.
// Espace d'un ENSEIGNANT INDÉPENDANT (ecoles.type_espace = 'enseignant').
//
// Un enseignant seul ouvre son espace gratuit, même si son école n'utilise
// pas EduGest (décision du 2026-11-18). C'est une petite école dont il est
// l'unique compte, avec les droits de la direction : tout le code des
// classes, élèves, notes et bulletins sert tel quel. On n'y montre que ce
// qui sert à un enseignant : ni comptabilité, ni comptes (parents ou
// personnel), ni gouvernance, ni proposition d'abonnement.
//
// Le serveur tient les mêmes règles : ecoles_guard (type d'espace immuable
// depuis l'école) et account-manage/espace-enseignant.ts (aucun autre compte).
// Module SANS dépendance : constants.js l'importe.

export const TYPE_ESPACE_ENSEIGNANT = "enseignant";

export const estEspaceEnseignant = (schoolInfo) => schoolInfo?.typeEspace === TYPE_ESPACE_ENSEIGNANT;

// Modules du menu ouverts dans un espace enseignant. Les modules de section
// (primaire, secondaire) suivent en plus les niveaux enseignés.
export const MODULES_ESPACE_ENSEIGNANT = Object.freeze(["primaire", "secondaire", "parametres"]);

export const moduleOuvertEspaceEnseignant = (moduleId) => MODULES_ESPACE_ENSEIGNANT.includes(moduleId);

// Libellés des rôles : ceux d'une école (« Direction Generale » sous son nom,
// « Bureau College » en titre) n'ont pas de sens pour un enseignant seul.
// Données en français, comme les libellés par défaut (shared/role-config.js). i18n-ignore
const LIBELLES_ROLES_ENSEIGNANT = Object.freeze({ direction: "Enseignant", primaire: "Primaire", college: "Secondaire" });

export const libelleRoleEspaceEnseignant = (schoolInfo, role) =>
  (estEspaceEnseignant(schoolInfo) && LIBELLES_ROLES_ENSEIGNANT[role]) || null;

// Module ouvert à la connexion : sa classe d'abord, pas les paramètres.
export function premierModuleEspaceEnseignant(modules) {
  return modules.find((id) => id === "primaire" || id === "secondaire") || modules[0] || null;
}

// Onglets du module École sans objet pour un enseignant seul : la liste des
// enseignants et leurs attributions, l'emploi du temps de l'école (il
// répartit des enseignants dans des créneaux) et les attestations, que
// signe le chef d'établissement. Ni la plateforme du ministère (DGECS),
// qui s'adresse aux établissements.
const ONGLETS_ECOLE_FERMES = new Set(["ens", "enseignements", "emploidutemps", "attestations", "dgecs"]);

export const ongletEcoleOuvert = (schoolInfo, ongletId) =>
  !estEspaceEnseignant(schoolInfo) || !ONGLETS_ECOLE_FERMES.has(ongletId);

// Onglets de Paramètres sans objet pour un enseignant seul.
const ONGLETS_PARAMETRES_FERMES = new Set(["notifications", "paiement", "accueil", "officiel"]);

export const ongletParametresOuvert = (schoolInfo, ongletId) =>
  !estEspaceEnseignant(schoolInfo) || !ONGLETS_PARAMETRES_FERMES.has(ongletId);
