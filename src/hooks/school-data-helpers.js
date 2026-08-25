// Helpers du hook useSchoolData : fusion du document école avec les valeurs
// par défaut et application du branding (variables CSS).
import { SCHOOL_INFO_DEFAUT } from "../contexts/SchoolContext";
import { getRoleSettingsForSchool } from "../constants";

export const DEFAULT_VERROUS = { comptable: false, primaire: false, secondaire: false };

// Fusionne les données Firestore de l'école avec SCHOOL_INFO_DEFAUT, en
// retombant sur les valeurs par défaut pour chaque champ absent.
export function mergeSchoolInfo(d) {
  const D = SCHOOL_INFO_DEFAUT;
  return {
    ...D,
    ...d,
    nom:       d.nom       || D.nom,
    type:      d.type      || D.type,
    ville:     d.ville     || D.ville,
    pays:      d.pays      || D.pays,
    couleur1:  d.couleur1  || D.couleur1,
    couleur2:  d.couleur2  || D.couleur2,
    logo:      d.logo      || D.logo,
    devise:    d.devise    || D.devise,
    monnaie:   d.monnaie   || D.monnaie,
    ministere: d.ministere || D.ministere,
    ire:       d.ire       || D.ire,
    dpe:       d.dpe       || D.dpe,
    agrement:  d.agrement  || D.agrement,
    moisDebut: d.moisDebut || D.moisDebut,
    plan:      d.plan      || "gratuit",
    planExpiry:d.planExpiry|| null,
    accueil:   d.accueil   || D.accueil,
    roleSettings: getRoleSettingsForSchool(d.roleSettings || D.roleSettings),
  };
}

// Applique les couleurs de branding aux variables CSS racine.
export function applyBrandingColors(couleur1, couleur2) {
  const r = document.documentElement.style;
  r.setProperty("--sc1", couleur1 || "#0A1628");
  r.setProperty("--sc2", couleur2 || "#00C48C");
}
