// Libellés AFFICHÉS de valeurs enregistrées en français (statut d'un élève,
// section…). La donnée ne change jamais — comparaisons, filtres et journal
// s'appuient sur elle — : seul ce qui s'affiche suit la langue choisie.
import i18n from "./index";

// i18n-ignore
const CLES_STATUT = { Actif: "statusActive", Inactif: "statusInactive", Transféré: "statusTransferred", Exclu: "statusExpelled", Abandonné: "statusDroppedOut", Décédé: "statusDeceased", Diplômé: "statusGraduated" };

export const libelleStatutEleve = (statut) =>
  (CLES_STATUT[statut] ? i18n.t(`enrolment.${CLES_STATUT[statut]}`) : statut || "");

// Même règle que getSectionLabel : une section inconnue est le collège.
const SECTIONS = ["prescolaire", "primaire", "college", "lycee"];
export const libelleSection = (section) =>
  i18n.t(`accounting.sections.${SECTIONS.includes(section) ? section : "college"}`);
