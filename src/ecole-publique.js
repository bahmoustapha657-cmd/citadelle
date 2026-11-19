// ── École publique (étape 4 de l'usage individuel, décisions du 2026-11-18) ──
// Une école publique paie un PRIX FIXE quel que soit son effectif et a tous
// les outils de gestion : plan `publique` (constants.js, élèves illimités),
// attribué par EduGest (superadmin) après vérification, comme les autres
// plans — la colonne `plan` est gardée par ecoles_guard.
//
// Le statut déclaré par l'école (inscription, `extra.statutEtablissement`)
// ne donne aucun droit : il sert seulement à lui proposer d'abord son offre
// et à lui retirer ce qui ne la concerne pas.
//
// PAS DE COMPTABILITÉ (décision du 2026-11-19, recherche sur les écoles
// publiques guinéennes) : primaire gratuit, enseignants payés par l'État,
// seule contribution des familles = cotisation APEAE, gérée par les parents.
// Une école publique n'a donc ni mensualités, ni caisse, ni paie, ni
// fondation. Retirer des écrans n'est pas un privilège : le statut déclaré
// suffit, sans vérification.
// Logique PURE (tests/ecole-publique.test.js). Extensions explicites : module
// aussi chargé par Node (tests) et Deno (copie des Edge Functions).
import { estEspaceEnseignant } from "./espace-enseignant.js";

export const PLAN_PUBLIQUE = "publique";

// Prix fixé par l'utilisateur le 2026-11-19 : 100 000 GNF par mois, quel que
// soit le nombre d'élèves. Seule source du montant : les textes (inscription,
// demande d'abonnement, page d'accueil) le reçoivent en {{prix}}.
export const PRIX_MENSUEL_PUBLIQUE = 100000;
export const prixEcolePublique = () => `${PRIX_MENSUEL_PUBLIQUE.toLocaleString("fr-FR")} GNF`;

export const estEcolePublique = (schoolInfo) => schoolInfo?.statutEtablissement === "public";

// Statut enregistré par Paramètres → Identité (et par l'inscription) :
// "public" ou "prive", rien d'autre.
export const statutNormalise = (statut) => (statut === "public" ? "public" : "prive");

// Type d'établissement (documents : certificat de radiation, page publique)
// d'une école qui n'en a pas saisi. Le défaut historique est celui d'une école
// privée (SCHOOL_INFO_DEFAUT) : faux pour une école publique.
export const TYPE_ECOLE_PRIVEE = "Groupe Scolaire Privé"; // i18n-ignore : donnée enregistrée
export const TYPE_ECOLE_PUBLIQUE = "École publique"; // i18n-ignore : donnée enregistrée
export const typeEtablissementParDefaut = (schoolInfo) =>
  (estEcolePublique(schoolInfo) ? TYPE_ECOLE_PUBLIQUE : TYPE_ECOLE_PRIVEE);

// Quand le statut change dans Paramètres, seul un type PAR DÉFAUT le suit ;
// un type saisi par l'école (« Lycée … », « Collège … ») reste le sien.
export const typeApresChangementStatut = (type, statut) =>
  (!type || type === TYPE_ECOLE_PRIVEE || type === TYPE_ECOLE_PUBLIQUE
    ? typeEtablissementParDefaut({ statutEtablissement: statut })
    : type);

// Écoles où personne ne paie l'école : l'espace d'un enseignant seul et
// l'école publique. Ni écran d'argent (tableau de bord, rapports), ni retrait
// des « non réinscrits » (un élève sans paiement n'y est pas un impayé), et
// les élèves s'inscrivent depuis l'onglet Élèves au lieu de la Comptabilité.
export const sansComptabilite = (schoolInfo) => estEspaceEnseignant(schoolInfo) || estEcolePublique(schoolInfo);

// Notes et bulletins retenus pour impayé (réglage de la Comptabilité) : jamais
// là où personne ne paie — même si le réglage date d'avant le passage au
// statut public, tous les bulletins seraient retenus.
export const blocageImpayeActif = (schoolInfo) => !!schoolInfo?.blocageParentImpaye && !sansComptabilite(schoolInfo);

// Modules du menu fermés à une école publique. La Comptabilité, elle, reste
// au menu sous le nom « Présences du personnel » : son onglet Présences sert
// (absentéisme des enseignants), et la table `presences` est gardée par le
// droit `compta` en base — la Direction l'a déjà.
const MODULES_FERMES_ECOLE_PUBLIQUE = new Set(["fondation"]);
export const moduleOuvertEcolePublique = (schoolInfo, moduleId) =>
  !estEcolePublique(schoolInfo) || !MODULES_FERMES_ECOLE_PUBLIQUE.has(moduleId);

// Seul onglet du module Comptabilité ouvert à une école publique.
export const ONGLET_COMPTA_ECOLE_PUBLIQUE = "presences";

// Onglets de Paramètres sans objet : le paiement en ligne des familles.
const ONGLETS_PARAMETRES_FERMES_PUBLIQUE = new Set(["paiement"]);
export const ongletParametresOuvertPublique = (schoolInfo, ongletId) =>
  !estEcolePublique(schoolInfo) || !ONGLETS_PARAMETRES_FERMES_PUBLIQUE.has(ongletId);

// Plans proposés dans la demande d'abonnement (tableau de bord). Tous restent
// demandables — une école déjà inscrite peut être publique sans l'avoir dit —
// mais une école publique voit le sien en premier, choisi d'avance.
export function plansDemandables(schoolInfo, plans) {
  const payants = Object.keys(plans || {}).filter((k) => k !== "gratuit");
  const autres = payants.filter((k) => k !== PLAN_PUBLIQUE);
  if (!payants.includes(PLAN_PUBLIQUE)) return autres;
  return estEcolePublique(schoolInfo) ? [PLAN_PUBLIQUE, ...autres] : [...autres, PLAN_PUBLIQUE];
}

export const planDemandeParDefaut = (schoolInfo, plans) => plansDemandables(schoolInfo, plans)[0] || "";
