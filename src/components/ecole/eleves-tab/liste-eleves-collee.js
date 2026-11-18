// Liste d'élèves tapée ou collée par un enseignant indépendant (onglet
// Élèves de son espace) : un élève par ligne.
//
// L'inscription d'un élève passe d'ordinaire par la Comptabilité, absente
// d'un espace enseignant. L'enseignant a sa liste sur papier ou dans un
// tableur : il la tape, ou il colle des cellules copiées depuis Excel
// (séparées par des tabulations). La filiation n'est pas demandée : la base
// ne contrôle les homonymes que lorsqu'elle est remplie.
//
// Ordre usuel en Guinée : NOM puis prénom(s) (« BAH Aminata »). Le sexe,
// facultatif, se met à la fin (« BAH Aminata F »).
//
// Les erreurs sont des CODES (traduits par l'écran) : ERREUR_NOM_PRENOM,
// ERREUR_DEJA_LA.

export const ERREUR_NOM_PRENOM = "nomPrenom";
export const ERREUR_DEJA_LA = "dejaLa";

// Classe retenue dans la fenêtre d'ajout : celle choisie si elle existe,
// sinon la première. Les classes peuvent arriver APRÈS l'ouverture de la
// fenêtre (synchronisation du mode hors ligne, réseau lent) : on ne fige
// jamais « aucune classe », sinon le bouton d'inscription ne ferait rien.
export const classeRetenue = (choix, noms) => (noms.includes(choix) ? choix : (noms[0] || ""));

// i18n-ignore
const SEXES = new Map([
  ["m", "M"], ["g", "M"], ["h", "M"], ["masculin", "M"], ["garcon", "M"], ["garçon", "M"], // i18n-ignore
  // i18n-ignore
  ["f", "F"], ["feminin", "F"], ["féminin", "F"], ["fille", "F"],
]);

const sexeDe = (mot) => SEXES.get(String(mot || "").trim().toLowerCase()) || null;

// Numéro d'ordre en tête de ligne (« 1. », « 12) », « 3 - ») : écarté.
const sansNumero = (ligne) => ligne.replace(/^\s*\d+\s*[.)\-–:]?\s+/, "");

// Une ligne → { nom, prenom, sexe } ou { erreur }.
export function lireLigneEleve(brute, { prenomDabord = false } = {}) {
  const ligne = sansNumero(String(brute ?? "")).trim();
  if (!ligne) return null;
  // Cellules collées depuis un tableur : une colonne par champ.
  let mots = ligne.includes("\t")
    ? ligne.split("\t").map((c) => c.trim()).filter(Boolean)
    : ligne.split(/\s+/);
  // Une cellule « N° » restée en tête après le collage.
  if (mots.length > 1 && /^\d+$/.test(mots[0])) mots = mots.slice(1);
  let sexe = null;
  if (mots.length > 2 || (mots.length === 2 && ligne.includes("\t"))) {
    sexe = sexeDe(mots[mots.length - 1]);
    if (sexe) mots = mots.slice(0, -1);
  }
  if (mots.length < 2) return { erreur: ERREUR_NOM_PRENOM, ligne };
  const [premier, ...reste] = prenomDabord
    ? [mots[mots.length - 1], ...mots.slice(0, -1)]
    : mots;
  return { nom: premier, prenom: reste.join(" "), sexe: sexe || "M", sexeIndique: !!sexe, ligne };
}

const cle = (s) => String(s || "").trim().toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

// Texte complet → lignes lues. `existants` : élèves déjà inscrits ; un élève
// de même nom et prénom déjà dans la classe choisie est signalé et écarté
// (liste collée deux fois).
export function lireListeEleves(texte, { prenomDabord = false, classe = "", existants = [] } = {}) {
  const dejaLa = new Set(existants
    .filter((e) => e.classe === classe)
    .map((e) => `${cle(e.nom)}|${cle(e.prenom)}`));
  return String(texte ?? "").split(/\r?\n/)
    .map((ligne) => lireLigneEleve(ligne, { prenomDabord }))
    .filter(Boolean)
    .map((l) => (l.erreur || !dejaLa.has(`${cle(l.nom)}|${cle(l.prenom)}`)
      ? l
      : { ...l, erreur: ERREUR_DEJA_LA }));
}
