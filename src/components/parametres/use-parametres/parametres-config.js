// Données et styles purs de l'écran « Paramètres de l'école » :
// constructeurs d'état initial (form / accueil), config des actions
// dangereuses, onglets et styles partagés. Aucun état React ici.
import { C } from "../../../constants";

// État initial du formulaire d'identité à partir de schoolInfo.
export function buildFormInitial(schoolInfo) {
  return {
    nom: schoolInfo.nom || "",
    type: schoolInfo.type || "Groupe Scolaire Privé",
    ville: schoolInfo.ville || "",
    pays: schoolInfo.pays || "République de Guinée",
    couleur1: schoolInfo.couleur1 || "#0A1628",
    couleur2: schoolInfo.couleur2 || "#00C48C",
    logo: schoolInfo.logo || "",
    devise: schoolInfo.devise || "",
    monnaie: schoolInfo.monnaie || "GNF",
    ministere: schoolInfo.ministere || "",
    ire: schoolInfo.ire || "",
    dpe: schoolInfo.dpe || "",
    agrement: schoolInfo.agrement || "",
    moisDebut: schoolInfo.moisDebut || "Octobre",
    periodicite: schoolInfo.periodicite || "trimestre",
    // Périodicité par section : permet "Primaire trimestre / Secondaire semestre".
    // Fallback sur le champ legacy `periodicite` pour rétrocompat.
    periodicitePrimaire: schoolInfo.periodicitePrimaire || schoolInfo.periodicite || "trimestre",
    periodiciteSecondaire: schoolInfo.periodiciteSecondaire || schoolInfo.periodicite || "trimestre",
  };
}

// État initial de l'onglet « Accueil » (page publique) à partir de schoolInfo.
export function buildAccueilInitial(schoolInfo) {
  const acc0 = schoolInfo.accueil || {};
  return {
    active: acc0.active || false,
    slogan: acc0.slogan || "",
    texteAccueil: acc0.texteAccueil || "",
    bannerUrl: acc0.bannerUrl || "",
    photos: acc0.photos || [],
    showAnnonces: acc0.showAnnonces !== false,
    showHonneurs: acc0.showHonneurs !== false,
    showContact: acc0.showContact !== false,
    telephone: acc0.telephone || "",
    email: acc0.email || "",
    facebook: acc0.facebook || "",
    whatsapp: acc0.whatsapp || "",
    adresse: acc0.adresse || "",
  };
}

export const dangerConfig = {
  deactivate: {
    title: "Desactiver l'ecole",
    confirmation: "DESACTIVER",
    tone: "#b45309",
    bg: "#fff7ed",
    border: "#fdba74",
    button: "#f59e0b",
    description: "L'acces sera bloque pour tous les comptes de cette ecole jusqu'a reactivation.",
  },
  delete: {
    title: "Supprimer l'ecole",
    confirmation: "SUPPRIMER",
    tone: "#b91c1c",
    bg: "#fef2f2",
    border: "#fca5a5",
    button: "#dc2626",
    description: "Suppression logique uniquement : les donnees sont preservees, mais l'ecole disparait de l'acces normal.",
  },
};

// Onglets de l'écran, groupés par thème pour une navigation lisible.
// Les ids sont stables (liens profonds : initialTab="officiel" depuis le
// tableau de bord). « Zone dangereuse » réservée aux profils habilités
// au cycle de vie.
export function buildTabItems(canManageLifecycle) {
  return [
    { id: "identite", label: "Identité", icon: "🏫", groupe: "École",
      desc: "Nom, logo, couleurs, devise, année scolaire et périodicité des bulletins." },
    { id: "officiel", label: "Officiel", icon: "📜", groupe: "École",
      desc: "Agrément, autorisations et codes statistiques — imprimés en pied des documents officiels." },
    { id: "evaluations", label: "Évaluations", icon: "📝", groupe: "Pédagogie",
      desc: "Libellés et activation des périodes d'évaluation (compositions, devoirs…)." },
    { id: "matricules", label: "Matricules", icon: "🆔", groupe: "Pédagogie",
      desc: "Format et numérotation des matricules élèves." },
    { id: "accueil", label: "Page publique", icon: "🌍", groupe: "Présentation",
      desc: "Site vitrine de l'école : bannière, photos, annonces, tableau d'honneur et contact." },
    { id: "affichage", label: "Affichage", icon: "🎨", groupe: "Présentation",
      desc: "Préférences d'affichage de l'application." },
    ...(canManageLifecycle ? [{ id: "danger", label: "Zone dangereuse", icon: "⚠️", groupe: "Avancé", danger: true,
      desc: "Désactivation ou suppression de l'établissement — actions sensibles et réversibles uniquement par EduGest." }] : []),
  ];
}

export const inp = {
  width: "100%", border: "1px solid #d1d5db", borderRadius: 8,
  padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box",
};
export const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, color: C.blueDark,
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, marginTop: 14,
};
export const sec = {
  background: "#fff", borderRadius: 14, padding: "24px 28px",
  boxShadow: "0 2px 16px rgba(0,32,80,0.07)", marginBottom: 20,
};
