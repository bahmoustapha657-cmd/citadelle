// ══════════════════════════════════════════════════════════════════════════
//  Mois des évaluations à la saisie des notes — logique pure
// ══════════════════════════════════════════════════════════════════════════
// Au secondaire, chaque oral et chaque écrit se saisit pour un MOIS précis,
// quelle que soit la périodicité (règle de la direction, 2026-11-25) : la note
// de cours d'une période est la moyenne de ses notes de cours mensuelles
// (cf. getSecondaryParts dans note-utils). Le mois proposé appartient à la
// période choisie (moisDePeriode). Pas de champ mois :
//  - pour une composition, une moyenne saisie directement, au primaire et en
//    maternelle (noteAvecMois) ;
//  - en périodicité mensuelle : la période EST le mois, enregistré d'office.
// Partagé par le module École (modale, grille, import) et le portail
// enseignant (modale, grille).

import { TOUS_MOIS_COURTS, TOUS_MOIS_LONGS } from "./constants";
import { estPeriodeMois, moisDePeriode } from "./period-utils";
import { noteAvecMois } from "./note-utils";

// Champ Mois d'une saisie : `avecMois` = la note porte un mois ; `visible` =
// on le demande (pas en périodicité mensuelle) ; `choix` = les mois de la
// période, dans l'ordre de l'année.
export function champMois({ type, section, periode, moisAnnee }) {
  if (!noteAvecMois(type, section)) return { avecMois: false, visible: false, choix: [] };
  if (estPeriodeMois(periode)) return { avecMois: true, visible: false, choix: [periode] };
  return { avecMois: true, visible: true, choix: moisDePeriode(periode, moisAnnee) };
}

// Mois enregistré avec la note : null quand elle n'en porte pas, la période
// elle-même en périodicité mensuelle, sinon le mois choisi.
export function moisAEnregistrer({ type, section, periode, mois }) {
  if (!noteAvecMois(type, section)) return null;
  if (estPeriodeMois(periode)) return periode;
  return mois || null;
}

// Mois d'une saisie à valider : vrai quand il n'en faut pas, ou quand le mois
// choisi est l'un des mois proposés.
export function moisValide({ type, section, periode, mois, moisAnnee }) {
  const champ = champMois({ type, section, periode, moisAnnee });
  if (!champ.visible) return true;
  return !!mois && champ.choix.includes(mois);
}

// Code du mois d'une date : le 14 octobre → « Oct ».
export const codeMoisDeDate = (date = new Date()) => TOUS_MOIS_COURTS[(date.getMonth() + 4) % 12];

// Mois proposé d'office : le mois en cours s'il appartient à la période,
// sinon rien (la saisie demande alors de choisir).
export function moisParDefaut(choix = [], maintenant = new Date()) {
  const code = codeMoisDeDate(maintenant);
  return choix.includes(code) ? code : "";
}

// Mois gardé quand la période ou le type change : le mois courant s'il reste
// proposé, sinon le mois par défaut.
export function moisAJour(mois, choix = [], maintenant = new Date()) {
  return mois && choix.includes(mois) ? mois : moisParDefaut(choix, maintenant);
}

// Mois affiché par une modale de saisie, et donc enregistré : le mois choisi
// s'il appartient à la période, sinon le mois en cours s'il en fait partie,
// sinon "" (à choisir). "" aussi quand le champ n'est pas demandé.
export function moisSaisi({ type, section, periode, mois, moisAnnee, maintenant = new Date() }) {
  const champ = champMois({ type, section, periode, moisAnnee });
  return champ.visible ? moisAJour(mois, champ.choix, maintenant) : "";
}

// ── Colonnes « période » des grilles ────────────────────────────────────────
// Une grille dont les colonnes sont des périodes (toutes les périodes d'une
// matière, d'un élève) passe à une colonne par (période, mois) pour une forme
// qui porte un mois : jeton « T1:Oct ». Sinon, une colonne par période :
// jeton « T1 ». Les codes de période et de mois ne contiennent ni « : » ni
// « | », les clés de cellule restent découpables.
export const jetonPeriode = (periode, mois = "") => (mois ? `${periode}:${mois}` : periode);

export function lireJetonPeriode(jeton = "") {
  const i = String(jeton).indexOf(":");
  return i === -1 ? { periode: String(jeton), mois: "" } : { periode: jeton.slice(0, i), mois: jeton.slice(i + 1) };
}

export function colonnesPeriodes(periodes = [], { avecMois = false, moisAnnee = [] } = {}) {
  return periodes.flatMap((periode) => {
    if (!avecMois || estPeriodeMois(periode)) return [{ jeton: periode, periode, mois: "" }];
    return moisDePeriode(periode, moisAnnee).map((mois) => ({ jeton: jetonPeriode(periode, mois), periode, mois }));
  });
}

// ── Import Excel ────────────────────────────────────────────────────────────
// Mois d'une ligne importée (colonne « Mois », après la note) :
//   { mois, erreur } — erreur "" (ligne valable), "manquant" (cellule vide ou
//   illisible) ou "horsPeriode" (mois qui n'appartient pas à la période).
// Sans mois pour une composition, au primaire… ; la période au mois.
export function moisImporte({ type, section, periode, valeur, moisAnnee }) {
  const champ = champMois({ type, section, periode, moisAnnee });
  if (!champ.avecMois) return { mois: null, erreur: "" };
  if (!champ.visible) return { mois: periode, erreur: "" };
  const mois = lireMois(valeur);
  if (!mois) return { mois: null, erreur: "manquant" };
  return { mois, erreur: champ.choix.includes(mois) ? "" : "horsPeriode" };
}

// ── Lecture d'un mois écrit dans un tableur (import Excel) ──────────────────
const sansAccents = (v) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const CODES = TOUS_MOIS_COURTS.map(sansAccents);
const NOMS = TOUS_MOIS_LONGS.map(sansAccents);

// « Oct », « octobre », « OCTOBRE », « Fév », « fevrier », « 10 » → code du
// mois (« Oct », « Fév »…) ; "" si la cellule ne nomme aucun mois.
export function lireMois(valeur) {
  const v = sansAccents(valeur).replace(/\.$/, "");
  if (!v) return "";
  if (/^\d{1,2}$/.test(v)) {
    const n = Number(v);
    return n >= 1 && n <= 12 ? TOUS_MOIS_COURTS[(n + 3) % 12] : "";
  }
  const i = CODES.indexOf(v) !== -1 ? CODES.indexOf(v) : NOMS.indexOf(v);
  if (i !== -1) return TOUS_MOIS_COURTS[i];
  // Abréviation libre (« janv », « sept ») : début non ambigu d'un nom.
  const debut = NOMS.map((nom, j) => (v.length >= 3 && nom.startsWith(v) ? j : -1)).filter((j) => j !== -1);
  return debut.length === 1 ? TOUS_MOIS_COURTS[debut[0]] : "";
}
