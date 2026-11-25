// « Tout » dans le sélecteur de section des Mensualités : toutes les sections
// ouvertes de l'école dans une même grille (Paramètres → Identité).
//
// Les élèves vivent dans UNE table Supabase, avec une colonne `section` que
// l'écriture impose d'après la collection (elevesCollege, elevesPrimaire…,
// cf. backend/collection-map.js). Écrire le paiement d'un élève du primaire
// par la collection du collège le ferait changer de section : en vue « Tout »,
// chaque écriture passe donc par la collection de SA section, retrouvée par la
// liste qui le contient.
// Aucune dépendance React : testable en isolation.
import { isSectionActive, sectionOuverte } from "../../../constants.js";

export const TOUTES_SECTIONS = "tout";

// Ordre du sélecteur de section des Mensualités.
export const SECTIONS_MENSUALITES = ["college", "lycee", "primaire", "prescolaire"];

export const sectionsMensualites = (schoolInfo) =>
  SECTIONS_MENSUALITES.filter((section) => isSectionActive(schoolInfo, section));

// Écoles qui gardent l'onglet Mensualités d'origine, à leur demande : ni
// « Tout » ni bouton « Situation des paiements » (situation générale, liste
// d'un mois). Clé = schoolId (code école), comme finances-claires.js.
const ECOLES_MENSUALITES_CLASSIQUES = new Set(["citadelle"]);

export const mensualitesClassiques = (schoolId) => ECOLES_MENSUALITES_CLASSIQUES.has(schoolId);

// « Tout » n'a de sens qu'à partir de deux sections ouvertes.
export const toutProposable = (schoolInfo, schoolId) =>
  !mensualitesClassiques(schoolId) && sectionsMensualites(schoolInfo).length > 1;

// Section retenue par le sélecteur : « Tout » s'il est proposable, sinon la
// section choisie si elle est ouverte, sinon la première ouverte.
export const sectionAffichee = (schoolInfo, choix, schoolId) =>
  (choix === TOUTES_SECTIONS && toutProposable(schoolInfo, schoolId) ? TOUTES_SECTIONS : sectionOuverte(schoolInfo, choix));

// Élèves affichés : ceux de la section, ou de toutes les sections ouvertes.
export function elevesAffiches(elevesParSection = {}, section, schoolInfo) {
  if (section !== TOUTES_SECTIONS) return elevesParSection[section] || [];
  return sectionsMensualites(schoolInfo).flatMap((s) => elevesParSection[s] || []);
}

// Section (clé de `elevesParSection`) de l'élève `id` : celle de la liste qui
// le contient ; null s'il n'est dans aucune.
export function sectionDeEleve(elevesParSection = {}, id) {
  if (!id) return null;
  return Object.keys(elevesParSection).find((s) => (elevesParSection[s] || []).some((e) => e._id === id)) || null;
}

// Section où écrire la fiche de l'élève `id` : la sienne ; à défaut, la
// section affichée — jamais « Tout », qui n'est pas une collection.
export function sectionEcriture(elevesParSection, id, sectionAfficheeCourante) {
  return sectionDeEleve(elevesParSection, id)
    || (sectionAfficheeCourante === TOUTES_SECTIONS ? null : sectionAfficheeCourante || null);
}
