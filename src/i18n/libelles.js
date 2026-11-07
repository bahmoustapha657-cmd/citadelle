// Libellés AFFICHÉS de valeurs enregistrées en français (statut d'un élève,
// section…). La donnée ne change jamais — comparaisons, filtres et journal
// s'appuient sur elle — : seul ce qui s'affiche suit la langue choisie.
import i18n, { localeCourante } from "./index";

// i18n-ignore
const CLES_STATUT = { Actif: "statusActive", Inactif: "statusInactive", Transféré: "statusTransferred", Exclu: "statusExpelled", Abandonné: "statusDroppedOut", Décédé: "statusDeceased", Diplômé: "statusGraduated" };

export const libelleStatutEleve = (statut) =>
  (CLES_STATUT[statut] ? i18n.t(`enrolment.${CLES_STATUT[statut]}`) : statut || "");

// Même règle que getSectionLabel : une section inconnue est le collège.
const SECTIONS = ["prescolaire", "primaire", "college", "lycee"];
export const libelleSection = (section) =>
  i18n.t(`accounting.sections.${SECTIONS.includes(section) ? section : "college"}`);

// Mois et jours enregistrés en toutes lettres (« Octobre », « Lundi »).
export const libelleMois = (mois) => (mois ? i18n.t(`months.${mois}`, mois) : "");
export const libelleJour = (jour) => (jour ? i18n.t(`weekdays.${jour}`, jour) : "");

// Mois abrégé des graphiques : « Octo » en français (inchangé), sinon
// l'abréviation de la langue (« Oct », « أكتوبر »).
// i18n-ignore
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
export const libelleMoisCourt = (mois) => {
  const i = MOIS.indexOf(mois);
  const locale = localeCourante();
  if (i < 0 || locale === "fr-FR") return String(mois || "").slice(0, 4);
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, i, 1));
};

// « 2026-10 » (mois d'une dépense) → « Octobre 2026 » dans la langue choisie.
export const libelleMoisAnnee = (cle) => {
  const [annee, m] = String(cle || "").split("-");
  const nom = MOIS[Number(m) - 1];
  return nom && annee ? `${libelleMois(nom)} ${annee}` : "";
};

// Catégories des dépenses et des recettes, bénéficiaires des versements :
// valeurs enregistrées en français, libellés traduits.
// i18n-ignore
const CLES_CAT_DEPENSE = { Salaires: "salaries", Matériel: "equipment", Infrastructure: "infrastructure", Charges: "utilities", Divers: "other" };
export const CATEGORIES_DEPENSE = Object.keys(CLES_CAT_DEPENSE);
export const libelleCategorieDepense = (categorie) =>
  (CLES_CAT_DEPENSE[categorie] ? i18n.t(`accounting.expCat.${CLES_CAT_DEPENSE[categorie]}`) : categorie || "");
// i18n-ignore
const CLES_CAT_RECETTE = { Scolarité: "tuition", Inscription: "enrolment", Examens: "exams", Activités: "activities", Don: "donation" };
export const CATEGORIES_RECETTE = Object.keys(CLES_CAT_RECETTE);
export const libelleCategorieRecette = (categorie) =>
  (CLES_CAT_RECETTE[categorie] ? i18n.t(`accounting.revCat.${CLES_CAT_RECETTE[categorie]}`) : categorie || "");
const CLES_BENEFICIAIRE = { Banque: "bank", Fondation: "foundation", Autre: "other" };
export const libelleBeneficiaire = (beneficiaire) =>
  (CLES_BENEFICIAIRE[beneficiaire] ? i18n.t(`accounting.benef.${CLES_BENEFICIAIRE[beneficiaire]}`) : beneficiaire || "");

// Section d'une fiche de paie ou d'un bon (« Secondaire », « Personnel »…).
// i18n-ignore
const CLES_GROUPE_PAIE = { Secondaire: "secondary", Primaire: "primary", Préscolaire: "preschool", Personnel: "staff" };
export const libelleSectionPaie = (section) =>
  (CLES_GROUPE_PAIE[section] ? i18n.t(`accounting.payGroup.${CLES_GROUPE_PAIE[section]}`) : section || "");

// Section d'un enseignant côté compta (`_section` : « Collège », « Lycée »…).
// i18n-ignore
const CLES_SECTION_ENS = { Préscolaire: "prescolaire", Primaire: "primaire", Collège: "college", Lycée: "lycee" };
export const libelleSectionEnseignant = (section) =>
  (CLES_SECTION_ENS[section] ? i18n.t(`accounting.sections.${CLES_SECTION_ENS[section]}`) : section || "");

// Statut d'un enseignant (« Titulaire », « Contractuel », « Vacataire »).
// i18n-ignore
const CLES_STATUT_ENS = { Titulaire: "permanent", Contractuel: "contract", Vacataire: "partTime" };
export const STATUTS_ENSEIGNANT = Object.keys(CLES_STATUT_ENS);
export const libelleStatutEnseignant = (statut) =>
  (CLES_STATUT_ENS[statut] ? i18n.t(`accounting.ensStatus.${CLES_STATUT_ENS[statut]}`) : statut || "");

// Catégories du personnel administratif : la valeur enregistrée reste française.
// i18n-ignore
const CLES_CATEGORIE = { Administration: "admin", Surveillance: "supervision", Entretien: "maintenance", Cuisine: "kitchen", Sécurité: "security", Divers: "other" };
export const CATEGORIES_PERSONNEL = Object.keys(CLES_CATEGORIE);
export const libelleCategoriePersonnel = (categorie) =>
  (CLES_CATEGORIE[categorie] ? i18n.t(`accounting.staffCat.${CLES_CATEGORIE[categorie]}`) : categorie || "");
