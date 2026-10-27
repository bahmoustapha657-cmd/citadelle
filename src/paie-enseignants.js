// ── Paie des enseignants, réservée à la Comptabilité ────────────────────────
// La paie (forfait, prime horaire, primes par classe) vit dans la table
// `paie_enseignants`, que seule la Comptabilité lit (RLS). Les écrans
// l'enregistrent toujours sur la fiche enseignant : un déclencheur la range
// dans la table (supabase/migrations/20261027171600_paie_enseignants.sql).
// Les écrans qui en ont besoin la remettent sur la fiche à la lecture.
//
// Pur (aucun import) : testable sous Node.

// ⚠️ Miroir de paie_enseignant_extraire() côté SQL : même liste, même ordre.
export const CLES_PAIE_ENSEIGNANT = Object.freeze([
  "montantForfait", "salaireBase", "forfait", "primeHoraire", "primeParClasse",
]);

// Champs de paie présents sur un objet (fiche ou ligne de paie).
export function extrairePaie(objet = {}) {
  const paie = {};
  for (const cle of CLES_PAIE_ENSEIGNANT) {
    if (objet && Object.prototype.hasOwnProperty.call(objet, cle)) paie[cle] = objet[cle];
  }
  return paie;
}

// Lignes de `paie_enseignants` indexées par id d'enseignant.
export function indexerPaie(lignes = []) {
  return new Map(lignes.map((ligne) => [ligne._id, extrairePaie(ligne)]));
}

// Fiche + sa paie. Une paie encore présente sur la fiche l'emporte : c'est
// une saisie de la Comptabilité pas encore rangée par le serveur (écriture
// hors ligne en attente), donc la plus récente.
export function fusionnerPaie(enseignant, paieParId) {
  const paie = paieParId?.get(enseignant?._id);
  if (!paie) return enseignant;
  return { ...enseignant, ...paie, ...extrairePaie(enseignant) };
}

export const avecPaie = (enseignants = [], paieParId) =>
  enseignants.map((enseignant) => fusionnerPaie(enseignant, paieParId));
