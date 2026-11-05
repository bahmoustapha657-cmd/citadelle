// ══════════════════════════════════════════════════════════════
//  Non réinscrits retirés des classes — règle de l'école, appliquée partout
// ══════════════════════════════════════════════════════════════
// Un « non réinscrit » est un élève présent (statut « Actif ») qui n'a fait
// AUCUN paiement de l'année : ni inscription / réinscription, ni mensualité,
// ni frais, ni acompte. Un élève dispensé de toute l'inscription n'en est
// jamais un : la Direction l'a inscrit d'office.
//
// Ces élèves disparaissent des listes de leur classe — module École (chefs de
// section, Direction), portail enseignant, grille et alerte des mensualités —
// sans que leur fiche soit modifiée. Dès qu'ils paient quoi que ce soit, ils
// réapparaissent partout.
//
// Deux déclencheurs :
// - automatique : passé un délai après le début de l'année officielle (un mois
//   par défaut : rentrée en octobre → le 1er novembre), dans TOUTES les
//   classes. Délai réglé par la comptabilité, 0 = jamais :
//   ecoles.extra.retraitNonReinscrits (0 à 3) ;
// - manuel, avant ce délai : classe par classe,
//   ecoles.extra.ecartesNonReinscrits = { "AAAA-AAAA": [classes] }.
// Les deux réglages sont écrits par la RPC maj_reglages_compta (droit
// d'écriture compta). La fonction Edge rappel-reinscriptions applique cette
// même règle (copie : scripts/partager-edge.mjs).
// Extension explicite des imports : module aussi chargé par Node (tests) et Deno.

import { TOUS_MOIS_LONGS, aReinscrire } from "./constants.js";
import { aDesPaiements } from "./depart-utils.js";
import { estExonereTotal } from "./exoneration-utils.js";

export const estNonReinscritSansPaiement = (eleve = {}) => aReinscrire(eleve) && !aDesPaiements(eleve)
  && !estExonereTotal(eleve, "inscription");

// ── Retrait automatique ─────────────────────────────────────────────────────
export const DELAI_RETRAIT_DEFAUT = 1;
export const DELAI_RETRAIT_MAX = 3;

// Délai (en mois après le début de l'année) réglé par l'école ; 0 = jamais.
export function delaiRetraitEcole(schoolInfo = {}) {
  const v = schoolInfo?.retraitNonReinscrits;
  return Number.isInteger(v) && v >= 0 && v <= DELAI_RETRAIT_MAX ? v : DELAI_RETRAIT_DEFAUT;
}

// Premier jour où les non réinscrits de `annee` quittent leur classe : le 1er
// du mois qui suit les `delai` premiers mois de l'année (rentrée en octobre,
// un mois → 1er novembre). Comme finAnneeScolaire, septembre ouvre l'année.
// null si la règle est coupée ou l'année illisible.
export function dateRetraitNonReinscrits(annee, moisDebut = "Octobre", delai = DELAI_RETRAIT_DEFAUT) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(annee || "").trim());
  if (!m || !Number.isInteger(delai) || delai <= 0) return null;
  const rangDebut = TOUS_MOIS_LONGS.indexOf(moisDebut);
  return new Date(Number(m[1]), 8 + (rangDebut >= 0 ? rangDebut : 1) + delai, 1);
}

// Date de retrait de l'année officielle de l'école (null : jamais).
export const dateRetraitEcole = (schoolInfo = {}, annee = schoolInfo?.anneeScolaire) =>
  dateRetraitNonReinscrits(annee, schoolInfo?.moisDebut || "Octobre", delaiRetraitEcole(schoolInfo));

// Le retrait automatique vaut-il pour `annee` à cet instant ? Seulement pour
// l'année OFFICIELLE de l'école : une année close consultée en archive garde
// ses élèves (bulletins, classements d'alors).
export function retraitEnVigueur(schoolInfo = {}, annee = schoolInfo?.anneeScolaire, maintenant = new Date()) {
  const officielle = schoolInfo?.anneeScolaire;
  if (!annee || (officielle && annee !== officielle)) return false;
  const date = dateRetraitEcole(schoolInfo, annee);
  return !!date && maintenant >= date;
}

// ── Retrait manuel, classe par classe ───────────────────────────────────────
// Classes écartées de l'année `annee` (par défaut l'année officielle).
export function classesEcarteesEcole(schoolInfo = {}, annee = schoolInfo?.anneeScolaire) {
  const classes = schoolInfo?.ecartesNonReinscrits?.[annee];
  return Array.isArray(classes) ? classes.filter((c) => typeof c === "string" && c) : [];
}

// Règle de l'année : `toutes` (retrait automatique en vigueur) ou les
// `classes` écartées à la main.
export const regleEcartement = (schoolInfo = {}, annee = schoolInfo?.anneeScolaire, maintenant = new Date()) => ({
  toutes: retraitEnVigueur(schoolInfo, annee, maintenant),
  classes: classesEcarteesEcole(schoolInfo, annee),
});

// Partage `eleves` entre ceux qui restent visibles et ceux écartés. `regle` :
// celle de regleEcartement, ou directement une liste de classes.
export function ecarterNonReinscrits(eleves = [], regle = []) {
  const { toutes = false, classes: liste = [] } = Array.isArray(regle) ? { classes: regle } : (regle || {});
  const classes = new Set(liste);
  const gardes = [];
  const ecartes = [];
  for (const eleve of eleves) {
    const vise = toutes || (classes.size > 0 && classes.has(eleve.classe));
    (vise && estNonReinscritSansPaiement(eleve) ? ecartes : gardes).push(eleve);
  }
  return { gardes, ecartes };
}

// Les élèves visibles, règle de l'école appliquée.
export const sansNonReinscritsEcartes = (eleves = [], schoolInfo = {}, annee = schoolInfo?.anneeScolaire, maintenant = new Date()) =>
  ecarterNonReinscrits(eleves, regleEcartement(schoolInfo, annee, maintenant)).gardes;

// Valeur complète à enregistrer quand les classes écartées de `annee`
// changent (les autres années sont gardées ; une année vide disparaît).
export function reglageEcartes(schoolInfo = {}, annee, classes = []) {
  const actuel = schoolInfo?.ecartesNonReinscrits;
  const reglage = actuel && typeof actuel === "object" && !Array.isArray(actuel) ? { ...actuel } : {};
  const propres = [...new Set(classes.filter((c) => typeof c === "string" && c))];
  if (propres.length) reglage[annee] = propres; else delete reglage[annee];
  return reglage;
}

// ── Lecture légère des fiches ───────────────────────────────────────────────
// Colonnes PostgREST qui suffisent à appliquer la règle (le reste de `extra`
// — archives des années passées — n'est pas lu) : rappel de la cloche et
// fonction Edge rappel-reinscriptions.
export const CHAMPS_PAIEMENT = [
  "inscriptionPayee", "autrePayee", "inscriptionAcompte", "mens", "mensAcomptes", "fraisPayes", "fraisAcomptes", "exoneration",
];
export const SELECT_PAIEMENTS_ELEVE = ["id", "nom", "prenom", "classe", "statut", ...CHAMPS_PAIEMENT.map((c) => `${c}:extra->${c}`)].join(",");

// Ligne lue avec SELECT_PAIEMENTS_ELEVE → fiche (forme camelCase de l'app).
export function elevePaiementsDepuisLigne(ligne = {}) {
  const eleve = { _id: ligne.id, nom: ligne.nom, prenom: ligne.prenom, classe: ligne.classe, statut: ligne.statut };
  for (const c of CHAMPS_PAIEMENT) if (ligne[c] !== undefined && ligne[c] !== null) eleve[c] = ligne[c];
  return eleve;
}

// Date du retrait à l'écran : « 1er novembre 2026 » en français, format
// de la langue sinon (anglais, arabe).
export function formaterDateRetrait(date, langue = "fr") {
  if (!date) return "";
  if (!String(langue).startsWith("fr")) {
    return date.toLocaleDateString(langue, { day: "numeric", month: "long", year: "numeric" });
  }
  const mois = TOUS_MOIS_LONGS[(date.getMonth() + 4) % 12].toLowerCase();
  return `${date.getDate() === 1 ? "1er" : date.getDate()} ${mois} ${date.getFullYear()}`;
}

// « le 1er novembre 2026 » : texte français du rappel envoyé par le serveur.
export const libelleDateRetrait = (date) => (date ? `le ${formaterDateRetrait(date)}` : ""); // i18n-ignore
