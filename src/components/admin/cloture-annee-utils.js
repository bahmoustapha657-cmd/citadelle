// Clôture d'année — logique pure (aucun accès réseau, aucun backend).
// Les écritures vivent dans cloture-annee.js ; ce fichier reste importable
// partout (Compta le lit pour projeter une année archivée) et testable.

import { initMens } from "../../constants";

// Toutes les sections, préscolaire compris.
export const COLLECTIONS_ELEVES = [
  "elevesPrescolaire", "elevesPrimaire", "elevesCollege", "elevesLycee",
];

// Les champs de scolarité portés par la fiche élève : c'est exactement ce
// qu'on archive, et exactement ce qu'on remet à zéro.
export const CHAMPS_SCOLARITE = [
  "mens", "mensDates", "mensMontants", "fraisPayes",
  "inscriptionPayee", "inscriptionDate", "autrePayee", "autreDate",
  // Archivé ET restauré : la clôture bascule les élèves actifs en
  // « Réinscription », l'annulation doit pouvoir revenir en arrière.
  "typeInscription",
];

// Instantané de l'année pour un élève : les champs de scolarité + la classe
// qu'il occupait (la promotion l'aura changée juste après).
export function instantaneEleve(eleve = {}) {
  const snap = { classe: eleve.classe || "" };
  for (const champ of CHAMPS_SCOLARITE) {
    if (eleve[champ] !== undefined) snap[champ] = eleve[champ];
  }
  return snap;
}

// État « année neuve » : tous les mois impayés, aucune date, aucun frais.
// `moisAnnee` = les mois RÉELS de l'école (elle peut démarrer en septembre) ;
// sans lui on retombe sur la liste par défaut d'initMens().
export function etatVierge(moisAnnee = null) {
  const mens = Array.isArray(moisAnnee) && moisAnnee.length
    ? moisAnnee.reduce((acc, mois) => ({ ...acc, [mois]: "Impayé" }), {})
    : initMens();
  return {
    mens,
    mensDates: {},
    mensMontants: {},
    fraisPayes: {},
    inscriptionPayee: false,
    inscriptionDate: null,
    autrePayee: false,
    autreDate: null,
  };
}

// L'élève a-t-il quoi que ce soit d'encaissé sur son année courante ?
// Sert aux avertissements : clôturer une année vide n'apporte rien, et
// annuler une clôture ÉCRASE ce qui a déjà été encaissé depuis.
export function aDesPaiements(eleve = {}) {
  const mens = eleve.mens || {};
  if (Object.values(mens).some((v) => v === "Payé")) return true;
  if (eleve.inscriptionPayee || eleve.autrePayee) return true;
  return Object.keys(eleve.fraisPayes || {}).length > 0;
}

// Champs à écrire pour clôturer un élève : l'archive complétée + l'état
// vierge. Renvoie null si l'année est DÉJÀ archivée — une seconde clôture
// écrirait l'état vierge par-dessus le vrai instantané.
export function champsCloture(eleve = {}, annee = "", { moisAnnee = null, maintenant = new Date() } = {}) {
  const historique = { ...(eleve.historique || {}) };
  if (historique[annee]) return null;
  historique[annee] = { ...instantaneEleve(eleve), clotureLe: maintenant.toISOString() };
  // Un élève encore présent l'année suivante EST un réinscrit : on bascule son
  // type d'inscription pour que le tarif de réinscription s'applique de
  // lui-même. Sans cela, il fallait ouvrir les fiches une par une — 501 fois
  // pour La Citadelle. Les élèves déjà partis gardent leur type d'origine :
  // leur fiche n'a pas vocation à décrire une rentrée qu'ils ne feront pas.
  const typeInscription = eleve.statut === "Actif" ? "Réinscription" : eleve.typeInscription;
  return {
    historique,
    ...etatVierge(moisAnnee),
    ...(typeInscription ? { typeInscription } : {}),
  };
}

// Champs à écrire pour restaurer l'année archivée sur la fiche. Renvoie null
// si cet élève n'a pas d'archive pour cette année. On repart de l'état vierge
// pour que les champs ABSENTS de l'instantané soient remis à zéro plutôt que
// laissés en place.
export function champsRestauration(eleve = {}, annee = "", { moisAnnee = null } = {}) {
  const historique = { ...(eleve.historique || {}) };
  const snap = historique[annee];
  if (!snap) return null;
  delete historique[annee];
  const champs = { ...etatVierge(moisAnnee), historique };
  for (const cle of CHAMPS_SCOLARITE) {
    if (snap[cle] !== undefined) champs[cle] = snap[cle];
  }
  if (snap.classe) champs.classe = snap.classe;
  return champs;
}

// Années déjà archivées sur au moins une fiche, de la plus récente à la plus
// ancienne.
export function anneesArchivees(eleves = []) {
  const annees = new Set();
  for (const eleve of eleves) {
    for (const annee of Object.keys(eleve.historique || {})) annees.add(annee);
  }
  return [...annees].sort().reverse();
}

// État de scolarité d'un élève POUR une année donnée : l'instantané si
// l'année est clôturée, sinon la fiche courante. Point d'entrée unique pour
// lire une année archivée sans dupliquer la logique ailleurs.
export function scolaritePourAnnee(eleve = {}, annee = "", anneeCourante = "") {
  const snap = (eleve.historique || {})[annee];
  if (!snap || annee === anneeCourante) return eleve;
  return { ...eleve, ...snap };
}
