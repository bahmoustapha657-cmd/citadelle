import { SECTIONS_ECOLE, genererMatricule, isSectionActive } from "../../../constants";

// Saisie rapide (fratrie / même tuteur). Une fratrie se répartit souvent sur
// plusieurs cycles — l'aîné au collège, le cadet au primaire. La modale était
// enfermée dans la section affichée par la barre d'outils (classes, matricule
// ET collection d'enregistrement) : impossible d'y inscrire le cadet sans
// fermer, changer de section et tout ressaisir. Chaque élève porte désormais
// SA section (form.niveau), choisie dans la modale.

// Sections proposées : celles ouvertes dans l'école, dans l'ordre des cycles.
export const sectionsSaisieRapide = (schoolInfo) =>
  SECTIONS_ECOLE.filter((section) => isSectionActive(schoolInfo, section));

// Matricule suivant d'une section. Les élèves ajoutés pendant la saisie
// comptent en plus de la liste chargée : celle-ci peut n'être rechargée
// qu'après le clic suivant, et deux élèves recevraient le même numéro.
export const matriculeSaisieRapide = (section, { elevesParNiveau = {}, ajoutes = [], schoolInfo = {} } = {}) =>
  genererMatricule(
    [...(elevesParNiveau[section] || []), ...ajoutes.filter((eleve) => eleve.niveau === section)],
    section,
    schoolInfo,
  );

// Informations de la fratrie, conservées d'un élève au suivant. Une fratrie
// arrive le même jour : la date d'arrivée suit le tuteur et le domicile.
const CHAMPS_COMMUNS = ["tuteur", "contactTuteur", "filiation", "domicile", "dateArrivee"];

// Formulaire de l'élève suivant : infos communes et section conservées, le
// reste (nom, prénom, classe, photo…) repart à vide.
export const formulaireEleveSuivant = (precedent = {}, section, matricule) => ({
  ...Object.fromEntries(CHAMPS_COMMUNS.map((champ) => [champ, precedent[champ]])),
  statut: "Actif", sexe: "M", niveau: section, matricule, typeInscription: "Première inscription",
});

// Changement de section : la classe (propre à chaque cycle) est vidée et le
// matricule recalculé — son préfixe dépend de la section.
export const changerSectionFormulaire = (form = {}, section, matricule) => ({
  ...form, niveau: section, classe: "", matricule,
});

// Rien de saisi pour l'élève en cours : « Terminer » après « Élève suivant »
// ferme la modale au lieu de réclamer un nom pour une fiche vide.
export const eleveVide = (form = {}) =>
  !["nom", "prenom", "classe", "dateNaissance", "photo"].some((champ) => String(form[champ] || "").trim());
