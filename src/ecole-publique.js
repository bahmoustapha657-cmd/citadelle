// ── École publique (étape 4 de l'usage individuel, décisions du 2026-11-18) ──
// Une école publique paie un PRIX FIXE quel que soit son effectif et a tous
// les outils de gestion : plan `publique` (constants.js, élèves illimités),
// attribué par EduGest (superadmin) après vérification, comme les autres
// plans — la colonne `plan` est gardée par ecoles_guard.
//
// Le statut déclaré par l'école (inscription, `extra.statutEtablissement`)
// ne donne aucun droit : il sert seulement à lui proposer d'abord son offre.
// Logique PURE (tests/ecole-publique.test.js).

export const PLAN_PUBLIQUE = "publique";

export const estEcolePublique = (schoolInfo) => schoolInfo?.statutEtablissement === "public";

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
