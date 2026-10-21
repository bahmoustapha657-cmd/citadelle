// ══════════════════════════════════════════════════════════════
//  Non réinscrits écartés — réglage de l'école, appliqué partout
// ══════════════════════════════════════════════════════════════
// Le comptable peut, classe par classe, écarter les élèves présents (statut
// « Actif ») dont l'inscription n'est pas encaissée ET qui n'ont rien payé
// de l'année : sans doute pas revenus. Ils disparaissent alors des listes de
// la classe — alerte mensualités, module École (chefs de section, Direction),
// portail enseignant — sans que leur fiche soit modifiée. Dès qu'un élève
// paie quoi que ce soit, il réapparaît partout.
//
// Réglage : ecoles.extra.ecartesNonReinscrits = { "AAAA-AAAA": [classes] },
// écrit par la RPC maj_reglages_compta (droit d'écriture compta).
// Extension explicite des imports : module aussi chargé par Node (tests).

import { aReinscrire } from "./constants.js";
import { aDesPaiements } from "./depart-utils.js";

export const estNonReinscritSansPaiement = (eleve = {}) => aReinscrire(eleve) && !aDesPaiements(eleve);

// Classes écartées de l'année `annee` (par défaut l'année officielle).
export function classesEcarteesEcole(schoolInfo = {}, annee = schoolInfo?.anneeScolaire) {
  const classes = schoolInfo?.ecartesNonReinscrits?.[annee];
  return Array.isArray(classes) ? classes.filter((c) => typeof c === "string" && c) : [];
}

// Partage `eleves` entre ceux qui restent visibles et ceux écartés.
export function ecarterNonReinscrits(eleves = [], classesEcartees = []) {
  const classes = new Set(classesEcartees);
  const gardes = [];
  const ecartes = [];
  for (const eleve of eleves) {
    (classes.size && classes.has(eleve.classe) && estNonReinscritSansPaiement(eleve) ? ecartes : gardes).push(eleve);
  }
  return { gardes, ecartes };
}

// Les élèves visibles, réglage de l'école appliqué.
export const sansNonReinscritsEcartes = (eleves = [], schoolInfo = {}, annee = schoolInfo?.anneeScolaire) =>
  ecarterNonReinscrits(eleves, classesEcarteesEcole(schoolInfo, annee)).gardes;

// Valeur complète à enregistrer quand les classes écartées de `annee`
// changent (les autres années sont gardées ; une année vide disparaît).
export function reglageEcartes(schoolInfo = {}, annee, classes = []) {
  const actuel = schoolInfo?.ecartesNonReinscrits;
  const reglage = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? { ...actuel } : {};
  const propres = [...new Set(classes.filter((c) => typeof c === "string" && c))];
  if (propres.length) reglage[annee] = propres; else delete reglage[annee];
  return reglage;
}
