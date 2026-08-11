// Helpers purs de l'emploi du temps extraits de EmploiDuTempsTab.jsx
// (découpage 2026-05-29).

import { JOURS_SEMAINE, getSectionForClasse } from "../../../constants";

// Réexporté pour que les modules EDT gardent un point d'entrée unique.
export { JOURS_SEMAINE };

// Le réglage est PAR SECTION, comme la périodicité : le primaire s'arrête
// souvent le vendredi quand le secondaire travaille le samedi.
// Le préscolaire suit le primaire (mêmes horaires, mêmes familles).
const CLE_JOURS = {
  primaire: "joursOuvrablesPrimaire",
  secondaire: "joursOuvrablesSecondaire",
};

export const sectionJours = (section = "secondaire") =>
  (section === "primaire" || section === "prescolaire" ? "primaire" : "secondaire");

// Garde l'ordre canonique de la semaine quel que soit l'ordre d'enregistrement,
// et rejette les listes vides ou illisibles (→ null, l'appelant se replie).
function normaliserJours(brut) {
  if (!Array.isArray(brut) || !brut.length) return null;
  const retenus = JOURS_SEMAINE.filter((j) => brut.includes(j));
  return retenus.length ? retenus : null;
}

// Jours ouvrés d'une section (ecoles.extra.joursOuvrable{Primaire,Secondaire}).
// Priorité : champ de la section → champ global legacy → semaine complète.
export function getJoursOuvrables(schoolInfo = {}, section = "secondaire") {
  return normaliserJours(schoolInfo?.[CLE_JOURS[sectionJours(section)]])
    || normaliserJours(schoolInfo?.joursOuvrables)
    || [...JOURS_SEMAINE];
}

// Jours ouvrés applicables à une classe, sa section étant déduite de son nom.
export function getJoursOuvrablesPourClasse(schoolInfo = {}, classe = "") {
  return getJoursOuvrables(schoolInfo, getSectionForClasse(classe));
}

// EDT général : toutes les classes partagent un seul tableau, donc les colonnes
// sont l'UNION des deux sections (une colonne Samedi vide pour le primaire vaut
// mieux qu'un samedi du secondaire escamoté).
export function getJoursOuvrablesUnion(schoolInfo = {}) {
  const primaire = getJoursOuvrables(schoolInfo, "primaire");
  const secondaire = getJoursOuvrables(schoolInfo, "secondaire");
  return JOURS_SEMAINE.filter((j) => primaire.includes(j) || secondaire.includes(j));
}

export const COULEURS = ["#dbeafe", "#dcfce7", "#fef9c3", "#ffe4e6", "#f3e8ff", "#ffedd5", "#e0f2fe", "#d1fae5", "#fce7f3", "#ecfdf5"];

export const SOUS_LABELS = ["Matière", "Enseignant", "Salle"];

const NIVEAUX_ORDER = [
  "maternelle", "ps", "ms", "gs", "petite section", "moyenne section", "grande section",
  "cp", "cp1", "cp2",
  "ce", "ce1", "ce2",
  "cm", "cm1", "cm2",
  "6ème", "6e", "6", "6eme",
  "5ème", "5e", "5", "5eme",
  "4ème", "4e", "4", "4eme",
  "3ème", "3e", "3", "3eme",
  "7ème", "7e", "7", "7eme",
  "8ème", "8e", "8", "8eme",
  "9ème", "9e", "9", "9eme",
  "10ème", "10e", "10", "10eme",
  "11ème", "11e", "11", "11eme",
  "seconde", "2nde", "2nd",
  "12ème", "12e", "12", "12eme",
  "première", "premiere", "1ère", "1ere",
  "13ème", "13e", "13", "13eme",
  "terminale", "tle", "term",
];

export function niveauRank(nom) {
  const n = (nom || "").toLowerCase().trim();
  const idx = NIVEAUX_ORDER.findIndex((o) => n === o || n.startsWith(o + " ") || n.startsWith(o + "-") || n.startsWith(o + "_"));
  if (idx >= 0) return idx * 10;
  const m = n.match(/^(\d+)/);
  if (m) return 500 + parseInt(m[1]);
  return 999;
}

export function genTranches(step, heureDebut, heureFin) {
  const [sh, sm] = (heureDebut || "08:00").split(":").map(Number);
  const [eh, em] = (heureFin || "14:00").split(":").map(Number);
  const t = [];
  let h = sh, m = sm;
  while (h * 60 + m <= eh * 60 + em) {
    t.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
    m += step;
    h += Math.floor(m / 60);
    m = m % 60;
  }
  return t;
}

// ── Grille ADAPTATIVE (durées de rubriques variables) ───────────────────────
// Une maternelle enchaîne des activités de durées différentes : accueil
// 15 min, regroupement 30, atelier 45, sieste 1 h… Une grille à pas FIXE ne
// sait pas les représenter : un créneau qui ne commence pas pile sur une
// tranche n'était tout simplement PAS affiché (getCreneau cherchait une
// égalité exacte sur l'heure de début). Les lignes sont donc désormais
// déduites des horaires RÉELLEMENT saisis, complétés par le pas régulier.

export const enMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

export const enHeure = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Bornes de lignes = pas régulier ∪ débuts/fins des créneaux du jour, triés
// et dédoublonnés, limités à la plage [heureDebut, heureFin] de la journée.
// `ajuster` (par défaut) resserre la grille sur la journée RÉELLE : elle
// commence au premier créneau et s'arrête au dernier. Sans cela, une plage
// large (08:00–14:00) affichait de longues traînées de lignes vides avant et
// après les cours, qui n'apportent rien et allongent l'impression.
export function genTranchesAdaptatives(step, heureDebut, heureFin, creneaux = [], ajuster = true) {
  let debut = enMinutes(heureDebut) ?? 8 * 60;
  let fin = enMinutes(heureFin) ?? 14 * 60;

  const debutsCreneaux = creneaux.map((c) => enMinutes(c.heureDebut)).filter((v) => v != null);
  const finsCreneaux = creneaux.map((c) => enMinutes(c.heureFin)).filter((v) => v != null);
  if (ajuster && debutsCreneaux.length) {
    // On ne resserre QUE vers l'intérieur : la plage réglée reste la borne
    // maximale, et un créneau saisi hors plage l'élargit plutôt que d'être perdu.
    debut = Math.min(Math.max(debut, Math.min(...debutsCreneaux)), ...debutsCreneaux);
    if (finsCreneaux.length) fin = Math.max(...finsCreneaux, Math.min(fin, Math.max(...finsCreneaux)));
  }
  if (fin <= debut) fin = debut + step;

  const bornes = new Set();
  for (let t = debut; t <= fin; t += step) bornes.add(t);
  bornes.add(fin);
  for (const c of creneaux) {
    const d = enMinutes(c.heureDebut);
    const f = enMinutes(c.heureFin);
    if (d != null && d >= debut && d <= fin) bornes.add(d);
    if (f != null && f >= debut && f <= fin) bornes.add(f);
  }
  return [...bornes].sort((a, b) => a - b).map(enHeure);
}

// Pour un jour : à quelle ligne commence chaque créneau, et sur combien de
// lignes il s'étend (rowSpan). Les lignes couvertes par un créneau sont
// marquées « occupées » pour ne pas rendre de cellule vide en trop, ce qui
// décalerait toute la colonne.
export function planifierJour(creneaux, tranches) {
  const debuts = new Map(); // index de ligne → { creneau, span }
  const occupees = new Set(); // index de lignes couvertes (hors ligne de début)
  const bornes = tranches.map(enMinutes);
  for (const c of creneaux) {
    const d = enMinutes(c.heureDebut);
    const f = enMinutes(c.heureFin);
    if (d == null) continue;
    let i = bornes.findIndex((b) => b === d);
    // Créneau hors bornes (saisi en dehors de la plage) : on l'accroche à la
    // première ligne qui le contient, plutôt que de le faire disparaître.
    if (i < 0) i = bornes.findIndex((b, k) => bornes[k + 1] != null && b <= d && d < bornes[k + 1]);
    if (i < 0 || i >= tranches.length - 1) continue;
    let j = f != null ? bornes.findIndex((b) => b === f) : -1;
    if (j < 0 && f != null) j = bornes.findIndex((b) => b >= f);
    const span = Math.max(1, (j > i ? j : i + 1) - i);
    debuts.set(i, { creneau: c, span });
    for (let k = i + 1; k < i + span; k++) occupees.add(k);
  }
  return { debuts, occupees };
}

export const affNom = (nomStr) => nomStr ? nomStr.replace(/\s*\([^)]*\)$/, "") : "";

// Nombre de sous-lignes d'un créneau dans l'EDT général : la 10e tranche
// (index 9) en a 4, les autres 3.
export const nbSousLignes = (ti) => ti === 9 ? 4 : 3;

export const totalLignesClasse = (nbTranches) => {
  let t = 0;
  for (let i = 0; i < nbTranches; i++) t += nbSousLignes(i);
  return t;
};

// Fabrique un chercheur d'enseignant par nom complet (ou nom + matière).
export const makeFindEns = (ens) => (nomStr) => ens.find((e) => {
  if (!nomStr) return false;
  const full = `${e.prenom || ""} ${e.nom || ""}`.trim();
  return nomStr === full || nomStr.startsWith(full + " (");
});
