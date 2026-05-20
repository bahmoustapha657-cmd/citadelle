// Données affichées sur la landing (modules, avantages, situations,
// FAQ, offres, etc.). Sorti du composant pour réduire sa taille et
// faciliter la traduction / mise à jour éditoriale.

export const MODULES = [
  {
    title: "Primaire",
    description: "Classes, notes, bulletins, absences et emplois du temps pour la maternelle et le primaire.",
  },
  {
    title: "Secondaire",
    description: "Collège et lycée avec matières, coefficients, moyennes et bulletins trimestriels.",
  },
  {
    title: "Comptabilité",
    description: "Scolarités, salaires, personnel, recettes, dépenses et suivi des impayés.",
  },
  {
    title: "Portail enseignant",
    description: "Emploi du temps, saisie des notes et suivi des paies dans un espace dédié.",
  },
  {
    title: "Portail parent",
    description: "Notes, absences, bulletins, paiements et messages depuis un seul compte.",
  },
  {
    title: "Communication",
    description: "Annonces, messagerie et informations de l'école diffusées simplement.",
  },
];

export const AVANTAGES = [
  {
    title: "Démarrage rapide",
    description: "Votre espace école peut être opérationnel le jour même, sans installation lourde.",
  },
  {
    title: "Identité personnalisée",
    description: "Logo, couleurs et informations de l'école apparaissent partout de façon cohérente.",
  },
  {
    title: "Données cloisonnées",
    description: "Chaque école reste isolée, chaque rôle ne voit que son périmètre utile.",
  },
  {
    title: "Accès mobile",
    description: "L'application fonctionne sur ordinateur, tablette et téléphone, sans installation spéciale.",
  },
];

export const SITUATIONS = [
  {
    situation: "Un parent réclame un reçu de l'année dernière",
    avant: "Recherche manuelle dans les cahiers et les dossiers.",
    apres: "Reçu retrouvé et imprimé en quelques secondes.",
  },
  {
    situation: "Le comptable est absent",
    avant: "La caisse reste difficile à relire ou à vérifier.",
    apres: "La direction garde une vue claire sur l'état des comptes.",
  },
  {
    situation: "Un parent veut savoir s'il est à jour",
    avant: "Discussion longue et vérification manuelle.",
    apres: "Le parent voit son historique et son solde dans son portail.",
  },
];

export const SEO_POINTS = [
  "Logiciel de gestion scolaire pour école privée en Guinée",
  "Gestion des notes, bulletins et moyennes par classe",
  "Comptabilité scolaire avec reçus, salaires et impayés",
  "Emplois du temps, examens et portail parent / enseignant",
];

export const FAQ_ITEMS = [
  {
    question: "À qui s'adresse EduGest ?",
    answer: "EduGest s'adresse aux écoles primaires, collèges, lycées et groupes scolaires privés qui veulent gérer élèves, notes, bulletins, comptabilité et emplois du temps dans un seul outil.",
  },
  {
    question: "Est-ce adapté aux écoles en Guinée ?",
    answer: "Oui. EduGest est pensé pour les réalités des écoles en Guinée et en Afrique de l'Ouest, avec une approche simple pour la direction, la comptabilité, les enseignants et les parents.",
  },
  {
    question: "Quelles fonctions sont les plus utiles ?",
    answer: "Les écoles utilisent surtout la gestion des élèves, la saisie des notes, les bulletins, la comptabilité scolaire, les paiements, les emplois du temps et les portails parent et enseignant.",
  },
];

export const SEO_LINKS = [
  {
    title: "Logiciel de gestion scolaire en Guinée",
    href: "/logiciel-gestion-scolaire-guinee.html",
    description: "Une page dédiée pour les directions qui recherchent une solution complète pour primaire, collège et lycée.",
  },
  {
    title: "Gestion des notes et bulletins",
    href: "/gestion-des-notes-et-bulletins.html",
    description: "Une page ciblée sur la saisie des notes, les moyennes et l'impression des bulletins scolaires.",
  },
  {
    title: "Comptabilité scolaire",
    href: "/comptabilite-scolaire.html",
    description: "Une page centrée sur les reçus, paiements, impayés, salaires et suivi comptable de l'école.",
  },
];

export const ARTICLE_LINKS = [
  {
    title: "Comment calculer un bulletin scolaire",
    href: "/comment-calculer-un-bulletin-scolaire.html",
  },
  {
    title: "Comment gérer les impayés scolaires",
    href: "/comment-gerer-les-impayes-scolaires.html",
  },
];

export const OFFRES = [
  {
    name: "Gratuit",
    price: "0 GNF / mois",
    features: ["Jusqu'à 50 élèves", "Notes et bulletins", "Une section active", "Support de base"],
    highlight: false,
    accent: "#94A3B8",
    accentSoft: "rgba(148,163,184,0.16)",
  },
  {
    name: "Starter",
    price: "100 000 GNF / mois",
    features: ["Jusqu'à 200 élèves", "Primaire et collège", "Comptabilité de base", "Portail enseignant"],
    highlight: false,
    accent: "#38BDF8",
    accentSoft: "rgba(56,189,248,0.14)",
  },
  {
    name: "Standard",
    price: "200 000 GNF / mois",
    features: ["Jusqu'à 500 élèves", "Toutes les sections", "Comptabilité complète", "Portail parent et enseignant"],
    highlight: true,
    accent: "#A78BFA",
    accentSoft: "rgba(167,139,250,0.16)",
    badge: "Recommandé",
  },
  {
    name: "Premium",
    price: "500 000 GNF / mois",
    features: ["Élèves illimités", "Toutes les fonctions", "Personnalisation avancée", "Support prioritaire"],
    highlight: false,
    accent: "#FBBF24",
    accentSoft: "rgba(251,191,36,0.14)",
  },
];

export const HERO_STATS = [
  { value: "3 min", label: "pour ouvrir une école" },
  { value: "100%", label: "des modules réunis" },
  { value: "24/7", label: "accès direction et parents" },
];
