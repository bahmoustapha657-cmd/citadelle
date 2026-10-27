// Reconnaître un enfant d'un coup d'œil — d'abord en maternelle, où la
// plupart des petits ne connaissent pas leur nom d'état civil : à la maison,
// on les appelle par un surnom (Néné, Bobo, Baby…), et dans une même classe
// plusieurs enfants portent le même prénom et le même nom de famille.
//
// Deux noms par enfant :
//  • le NOM D'APPEL, celui auquel il répond : son surnom s'il est renseigné,
//    sinon son prénom — c'est lui qu'on écrit en gros (trombinoscope, badge) ;
//  • son NOM OFFICIEL (« NOM Prénom », comme les listes de l'école), toujours
//    affiché à côté pour le rattacher à sa fiche.
//
// Le surnom vit dans le jsonb `extra` de la fiche (pas de colonne, pas de
// migration). Logique pure : testable sous Node.

// Longueur maximale d'un surnom : il doit tenir en gros sur un badge.
export const SURNOM_MAX = 30;

export const nettoyerSurnom = (valeur) =>
  String(valeur ?? "").replace(/\s+/g, " ").trim().slice(0, SURNOM_MAX);

const texte = (valeur) => String(valeur ?? "").replace(/\s+/g, " ").trim();

export const nomAppel = (eleve = {}) =>
  nettoyerSurnom(eleve.surnom) || texte(eleve.prenom) || texte(eleve.nom) || "?";

export const nomOfficiel = (eleve = {}) =>
  [texte(eleve.nom).toUpperCase(), texte(eleve.prenom)].filter(Boolean).join(" ");

// Deux lettres pour la vignette d'un enfant sans photo.
export const initiales = (eleve = {}) => {
  const lettre = (v) => (texte(v)[0] || "").toUpperCase();
  return (lettre(eleve.prenom) + lettre(eleve.nom)) || lettre(eleve.surnom) || "?";
};

// Minuscules sans accents : « Néné » se retrouve en tapant « nene ».
export const normaliser = (valeur) =>
  String(valeur ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Recherche d'un enfant : chaque mot tapé doit se retrouver dans son
// prénom, son nom, son surnom, le nom de son tuteur, sa filiation ou son
// matricule — « fatou bah » trouve « BAH Fatoumata », « mamadou » trouve
// l'enfant dont le père s'appelle Mamadou.
export const correspondEnfant = (eleve = {}, recherche = "") => {
  const mots = normaliser(recherche).split(" ").filter(Boolean);
  if (!mots.length) return true;
  const botte = normaliser([
    eleve.prenom, eleve.nom, eleve.surnom, eleve.tuteur, eleve.filiation, eleve.matricule,
  ].filter(Boolean).join(" "));
  return mots.every((mot) => botte.includes(mot));
};

// Ordre du trombinoscope et des badges : celui du nom écrit en gros, puis du
// nom officiel (deux « Mamadou » restent dans un ordre stable).
export const trierParNomAppel = (eleves = []) =>
  [...eleves].sort((a, b) =>
    nomAppel(a).localeCompare(nomAppel(b), "fr", { sensitivity: "base" })
    || nomOfficiel(a).localeCompare(nomOfficiel(b), "fr", { sensitivity: "base" }));

// Classes dans l'ordre naturel (« Petite Section A » avant « Petite Section B »).
export const comparerClasses = (a, b) =>
  String(a || "").localeCompare(String(b || ""), "fr", { numeric: true, sensitivity: "base" });

// [[classe, enfants triés par nom d'appel], …] dans l'ordre des classes.
export const grouperParClasse = (eleves = []) => {
  const groupes = new Map();
  for (const eleve of eleves) {
    const classe = texte(eleve.classe) || "Sans classe";
    if (!groupes.has(classe)) groupes.set(classe, []);
    groupes.get(classe).push(eleve);
  }
  return [...groupes.entries()]
    .sort(([a], [b]) => comparerClasses(a, b))
    .map(([classe, liste]) => [classe, trierParNomAppel(liste)]);
};

export const aUnePhoto = (eleve = {}) => !!texte(eleve.photo);

// Une couleur par niveau de maternelle, la même sur le badge, le
// trombinoscope et les vignettes : les petits reconnaissent une couleur bien
// avant un nom de classe. Les autres classes prennent la couleur de l'école.
export const COULEURS_NIVEAU = [
  { motif: /petite\s*section/i, couleur: "#ea580c", nom: "orange" },
  { motif: /moyenne\s*section/i, couleur: "#16a34a", nom: "vert" },
  { motif: /grande\s*section/i, couleur: "#2563eb", nom: "bleu" },
];

export const couleurClasse = (classe, parDefaut = "#0A1628") =>
  COULEURS_NIVEAU.find(({ motif }) => motif.test(String(classe || "")))?.couleur || parDefaut;

// ── Séance photo ─────────────────────────────────────────────
// File des enfants à photographier, figée au départ : la liste se met à jour
// à chaque photo enregistrée, et un enfant qui sort du filtre « sans photo »
// décalerait sinon tous les suivants. Ordre officiel (nom puis prénom) :
// celui du registre que lit la personne qui appelle les enfants.
export const fileSeancePhoto = (eleves = [], { classe = null, seulementSansPhoto = true, inclure = null } = {}) =>
  eleves
    .filter((e) => !classe || e.classe === classe)
    .filter((e) => !seulementSansPhoto || !aUnePhoto(e) || e._id === inclure)
    .sort((a, b) => nomOfficiel(a).localeCompare(nomOfficiel(b), "fr", { sensitivity: "base" }))
    .map((e) => e._id);

// Identifiant imprimé sur un badge : l'IEN (identifiant national) quand
// l'élève en a un, sinon le matricule de l'école ; null s'il n'a ni l'un ni
// l'autre.
export const identifiantBadge = (eleve = {}) => {
  const ien = String(eleve.ien ?? "").trim();
  if (ien) return { libelle: "IEN", valeur: ien };
  const matricule = String(eleve.matricule ?? "").trim();
  return matricule ? { libelle: "Matricule", valeur: matricule } : null;
};

// Champs à enregistrer pour un enfant : seulement ce qui change (la photo
// est déjà une URL téléversée ou en file d'attente hors ligne).
// `photoRetouche` : mémoire de la retouche qui accompagne une nouvelle photo
// (null pour une photo prise ou importée : l'ancienne mémoire ne vaut plus).
export const champsSeancePhoto = (eleve = {}, { surnom = eleve.surnom, photo = "", photoRetouche } = {}) => {
  const champs = {};
  const nouveau = nettoyerSurnom(surnom);
  if (nouveau !== nettoyerSurnom(eleve.surnom)) champs.surnom = nouveau;
  if (photo && photo !== eleve.photo) {
    champs.photo = photo;
    if (photoRetouche !== undefined) champs.photoRetouche = photoRetouche;
  }
  return champs;
};
