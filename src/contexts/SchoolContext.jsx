import { createContext } from "react";
import { getRoleSettingsMap } from "../../shared/role-config.js";

export const SCHOOL_INFO_DEFAUT = {
  nom: "EduGest",
  type: "Groupe Scolaire Privé",
  ville: "",
  pays: "République de Guinée",
  couleur1: "#0A1628",
  couleur2: "#00C48C",
  logo: null,
  devise: "",
  ministere: "Ministère de l'Éducation Nationale, de l'Alphabétisation, de l'Enseignement Technique et de la Formation Professionnelle",
  ire: "",
  dpe: "",
  agrement: "",
  moisDebut: "Octobre",
  plan: "gratuit",
  planExpiry: null,
  roleSettings: getRoleSettingsMap(),
  accueil: {
    active: false,
    slogan: "",
    texteAccueil: "",
    bannerUrl: "",
    photos: [],
    showAnnonces: true,
    showHonneurs: true,
    showContact: true,
    telephone: "",
    email: "",
    facebook: "",
    whatsapp: "",
    adresse: "",
  },
};

const defaultSchoolId =
  typeof window !== "undefined"
    ? localStorage.getItem("LC_schoolId") || "citadelle"
    : "citadelle";

export const SchoolContext = createContext({
  schoolId: defaultSchoolId,
  setSchoolId: () => {},
  schoolInfo: SCHOOL_INFO_DEFAUT,
  setSchoolInfo: () => {},
  moisAnnee: [],
  moisSalaire: [],
  toast: () => {},
  logAction: () => {},
  envoyerPush: () => {},
});
