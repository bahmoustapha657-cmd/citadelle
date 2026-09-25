// Dossier de transfert EduGest — logique pure (aucun accès réseau).
//
// Le dossier transmis à l'école d'accueil ne contient que l'IDENTITÉ de
// l'élève et de quoi l'accueillir. Sa scolarité (mois payés, dispenses,
// historique des années, départ) reste à l'école d'origine : envoyée en bloc,
// elle arrivait telle quelle sur la fiche de l'école d'accueil — l'élève y
// apparaissait « Transféré », avec des mensualités réglées ailleurs. Et moins
// le dossier porte de données, moins un token égaré en expose.

const CHAMPS_IDENTITE = [
  "_id", "section", "nom", "prenom", "sexe", "matricule", "ien", "classe",
  "dateNaissance", "lieuNaissance", "filiation", "tuteur", "contactTuteur", "domicile", "photo",
];

export function dossierTransfert(eleve = {}, { schoolNom = "", solde = 0 } = {}) {
  const dossier = {};
  for (const cle of CHAMPS_IDENTITE) {
    if (eleve[cle] != null && eleve[cle] !== "") dossier[cle] = eleve[cle];
  }
  // `solde` : ce que l'élève doit encore à l'école d'origine, pour
  // information de l'école d'accueil (cf. situation-depart).
  return { ...dossier, schoolNom, solde };
}

// Validité d'un token, appliquée par le serveur (supabase/transferts.sql).
export const VALIDITE_TOKEN_JOURS = 30;
const JOUR_MS = 86400000;

// État d'un transfert émis : "accepte", "expire" ou "en_attente" ; null sans
// transfert. `createdAt` : horodatage ISO renvoyé par la base.
export function etatTransfert(transfert, maintenant = Date.now()) {
  if (!transfert) return null;
  if (transfert.statut === "accepte") return "accepte";
  const cree = Date.parse(transfert.createdAt || "");
  if (Number.isFinite(cree) && maintenant - cree > VALIDITE_TOKEN_JOURS * JOUR_MS) return "expire";
  return "en_attente";
}

// Date de fin de validité (Date) d'un transfert, null si inconnue.
export function finValidite(transfert) {
  const cree = Date.parse(transfert?.createdAt || "");
  return Number.isFinite(cree) ? new Date(cree + VALIDITE_TOKEN_JOURS * JOUR_MS) : null;
}

// Dernier transfert émis pour un élève. `transferts` : du plus récent au plus
// ancien, comme les renvoie la base.
export const transfertDeLEleve = (transferts = [], eleveId) =>
  transferts.find((t) => t.eleveId === eleveId) || null;

// Un token se colle depuis WhatsApp ou un courriel : espaces, retours à la
// ligne et majuscules ne doivent pas le rendre « introuvable ».
export function normaliserToken(saisie = "") {
  const token = String(saisie).replace(/\s+/g, "").toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token) ? token : "";
}

// Classes proposées à l'accueil : celles que l'école utilise déjà dans la
// section (ses vraies divisions), puis la liste type de son système.
export function classesAccueil(classesExistantes = [], classesTypes = []) {
  return [...new Set([...classesExistantes.filter(Boolean), ...classesTypes])];
}
