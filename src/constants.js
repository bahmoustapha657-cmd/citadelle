// ══════════════════════════════════════════════════════════════
//  COULEURS
// ══════════════════════════════════════════════════════════════
export const C = {
  blue:"#0A1628", blueDark:"#0A1628", green:"#00C48C", greenDk:"#00A876",
  gold:"#FFB547", white:"#ffffff", bg:"#EEF2F7", sidebar:"#0A1628",
};

// ══════════════════════════════════════════════════════════════
//  MOIS / ANNÉE SCOLAIRE
// ══════════════════════════════════════════════════════════════
export const TOUS_MOIS_COURTS  = ["Sep","Oct","Nov","Déc","Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû"];
export const TOUS_MOIS_LONGS   = ["Septembre","Octobre","Novembre","Décembre","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août"];
// Valeurs par défaut (9 mois à partir d'Octobre — remplacées dynamiquement via SchoolContext)
export const MOIS_ANNEE   = TOUS_MOIS_COURTS.slice(1,10); // Oct→Jun
export const MOIS_SALAIRE = TOUS_MOIS_LONGS.slice(1,10);
// Calcule les 9 mois scolaires à partir d'un mois de début
export const calcMoisAnnee   = (debut="Octobre") => { const i=TOUS_MOIS_LONGS.indexOf(debut); return Array.from({length:9},(_,k)=>TOUS_MOIS_COURTS[(i+k)%12]); };
export const calcMoisSalaire = (debut="Octobre") => { const i=TOUS_MOIS_LONGS.indexOf(debut); return Array.from({length:9},(_,k)=>TOUS_MOIS_LONGS[(i+k)%12]); };
// Année scolaire — lue depuis localStorage
export const getAnnee = () => localStorage.getItem("LC_annee") || "2025-2026";

// ══════════════════════════════════════════════════════════════
//  CLASSES & MATIÈRES
// ══════════════════════════════════════════════════════════════
export const CLASSES_PRIMAIRE = [
  "Maternelle A","Maternelle B",
  "1ère Année A","1ère Année B",
  "2ème Année A","2ème Année B",
  "3ème Année A","3ème Année B",
  "4ème Année A","4ème Année B",
  "5ème Année A","5ème Année B",
  "6ème Année A","6ème Année B",
];
export const CLASSES_COLLEGE = [
  "7ème Année A","7ème Année B",
  "8ème Année A","8ème Année B",
  "9ème Année A","9ème Année B",
  "10ème Année A","10ème Année B",
];
export const CLASSES_LYCEE = [
  "11ème Année A","11ème Année B",
  "12ème Année A","12ème Année B",
  "Terminale A","Terminale B",
];

// Matières prédéfinies primaire (avec coefficient 1)
export const MATIERES_PRIMAIRE = [
  "Calcul","Écriture","Lecture","Histoire","Géographie",
  "Éducation Civique et Morale","Récitation et Chant","Langage",
  "Sciences d'Observation","Éducation Physique",
].map(nom=>({nom,coefficient:1}));

export const TOUTES_ANNEES = Array.from({length:30},(_,i)=>`${2025+i}-${2026+i}`);
export const MENSUALITE = { college:150000, primaire:120000 };
export const initMens = () => MOIS_ANNEE.reduce((a,m)=>({...a,[m]:"Impayé"}),{});

// ══════════════════════════════════════════════════════════════
//  MATRICULE
// ══════════════════════════════════════════════════════════════
// Génère automatiquement le prochain matricule
// Modèle configurable via schoolInfo (paramètres → Matricules)
export const genererMatricule = (eleves, type, config={}) => {
  const anneeShort = getAnnee().split("-")[0].slice(-2);
  const anneeFull  = getAnnee().split("-")[0];
  const pref = type==="college"
    ? (config.matriculePrefixColl||"C")
    : (config.matriculePrefixPrim||"P");
  const sep       = config.matriculeSep!=null ? config.matriculeSep : "-";
  const avecAnnee = config.matriculeAnnee !== false;
  const anneeStr  = avecAnnee ? (config.matriculeAnnee4 ? anneeFull : anneeShort) : "";
  const nChiffres = Number(config.matriculeChiffres||3);
  const prefix    = avecAnnee ? `${pref}${anneeStr}${sep}` : `${pref}${sep}`;
  const nums = eleves
    .map(e => e.matricule||"")
    .filter(m => m.startsWith(prefix))
    .map(m => parseInt(m.replace(prefix,""))||0);
  const suivant = nums.length > 0 ? Math.max(...nums)+1 : 1;
  return `${prefix}${String(suivant).padStart(nChiffres,"0")}`;
};

// ══════════════════════════════════════════════════════════════
//  FORMATAGE
// ══════════════════════════════════════════════════════════════
export const today = () => new Date().toLocaleDateString("fr-FR");
export const fmt   = n => Number(n||0).toLocaleString("fr-FR")+" GNF";
export const fmtN  = n => Number(n||0).toLocaleString("fr-FR");

// ══════════════════════════════════════════════════════════════
//  COMPTES & DROITS
// ══════════════════════════════════════════════════════════════
export const COMPTES_DEFAUT = [
  {id:"admin",     nom:"Administrateur",    login:"admin",     role:"admin",     label:"Administrateur"},
  {id:"direction", nom:"Directeur Général", login:"directeur", role:"direction", label:"Direction Générale"},
  {id:"primaire",  nom:"Dir. Primaire",     login:"primaire",  role:"primaire",  label:"Direction Primaire"},
  {id:"college",   nom:"Principal Collège", login:"college",   role:"college",   label:"Bureau Collège"},
  {id:"comptable", nom:"Comptable",         login:"comptable", role:"comptable", label:"Comptabilité"},
];

// Génère un mot de passe aléatoire sécurisé (12 caractères)
export const genererMdp = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
  return Array.from({length:12}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
};

// ══════════════════════════════════════════════════════════════
//  PLANS & LIMITES
// ══════════════════════════════════════════════════════════════
export const PLANS = {
  gratuit:  { label:"Gratuit",  eleveLimit:50,       couleur:"#64748b", bg:"#f1f5f9" },
  starter:  { label:"Starter",  eleveLimit:200,      couleur:"#0ea5e9", bg:"#e0f2fe" },
  standard: { label:"Standard", eleveLimit:500,      couleur:"#8b5cf6", bg:"#ede9fe" },
  premium:  { label:"Premium",  eleveLimit:Infinity, couleur:"#f59e0b", bg:"#fef3c7" },
};
// Durées standard (en jours)
export const PLAN_DUREES = [
  {label:"1 mois",  jours:30},
  {label:"3 mois",  jours:90},
  {label:"6 mois",  jours:180},
  {label:"1 an",    jours:365},
];

export const ACCES = {
  superadmin:  ["superadmin_panel"],
  admin:       ["accueil","historique","admin_panel","parametres","fondation","compta","primaire","secondaire","calendrier","examens","messages"],
  direction:   ["accueil","historique","admin_panel","parametres","fondation","compta","primaire","secondaire","calendrier","examens","messages"],
  primaire:    ["primaire","calendrier","examens"],
  college:     ["secondaire","calendrier","examens"],
  comptable:   ["compta","primaire","secondaire","calendrier","examens"],
  enseignant:  ["portail_enseignant"],
  parent:      ["portail_parent"],
};

// Qui peut modifier les élèves ?
export const peutModifierEleves = (role) => role === "comptable" || role === "admin" || role === "direction";
// Seuls admin et direction peuvent modifier/supprimer des enregistrements existants
export const peutModifier = (role) => role === "admin" || role === "direction";

export const MODULES = [
  {id:"superadmin_panel", label:"Super Admin",   icon:"⚙️", desc:"Gestion des écoles"},
  {id:"accueil",     label:"Tableau de bord",  icon:"📈", desc:"Vue d'ensemble"},
  {id:"historique",  label:"Historique",       icon:"📋", desc:"Journal des actions"},
  {id:"admin_panel", label:"Gestion Accès",   icon:"🔐", desc:"Mots de passe"},
  {id:"parametres",  label:"Paramètres",      icon:"🏫", desc:"Identité de l'école"},
  {id:"fondation",   label:"Fondation",        icon:"🏛️", desc:"Gouvernance"},
  {id:"compta",      label:"Comptabilité",     icon:"📊", desc:"Finances"},
  {id:"primaire",    label:"Dir. Primaire",    icon:"🎒", desc:"Primaire"},
  {id:"secondaire",  label:"Secondaire",        icon:"🏫", desc:"Bureau Collège"},
  {id:"calendrier",        label:"Calendrier",        icon:"📅", desc:"Événements scolaires"},
  {id:"examens",           label:"Examens",           icon:"📝", desc:"Planning & convocations"},
  {id:"portail_enseignant",label:"Mon Espace",         icon:"👨‍🏫", desc:"Portail enseignant"},
  {id:"portail_parent",    label:"Espace Parent",      icon:"👨‍👩‍👧", desc:"Suivi de mon enfant"},
  {id:"messages",          label:"Messages Parents",   icon:"💬", desc:"Liaison école-famille"},
];
