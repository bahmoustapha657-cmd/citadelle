import { createContext } from "react";

export const SCHOOL_INFO_DEFAUT = {
  nom: "EduGest", type: "Groupe Scolaire Privé",
  ville: "", pays: "",
  couleur1: "#0A1628", couleur2: "#00C48C",
  logo: null,
  devise: "",
  ministere: "",
  ire: "",
  dpe: "",
  agrement: "",
  moisDebut: "Octobre",
  plan: "gratuit",
  planExpiry: null,
  accueil: {
    active: false, slogan: "", texteAccueil: "", bannerUrl: "",
    photos: [], showAnnonces: true, showHonneurs: true, showContact: true,
    telephone: "", email: "", facebook: "", whatsapp: "", adresse: "",
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
