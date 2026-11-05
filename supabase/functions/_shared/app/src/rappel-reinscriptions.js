// GÉNÉRÉ par scripts/partager-edge.mjs depuis src/rappel-reinscriptions.js — ne pas modifier ici.
// ── Rappel des non réinscrits dans la cloche de l'en-tête ──────────────────
// Pour les comptes qui tiennent la comptabilité (écriture « compta ») : une
// fois le retrait automatique en vigueur, la cloche porte en tête un rappel
// « N élèves non réinscrits — faites-les réinscrire », tant qu'il en reste.
// La pastille le compte une fois par jour et par appareil (localStorage) :
// chaque matin, le rappel revient comme non lu. La notification push de 8 h
// (fonction Edge rappel-reinscriptions) dit la même chose, application fermée.
//
// Extension explicite des imports : module aussi chargé par Node (tests) et Deno.

import { dateRetraitEcole, estNonReinscritSansPaiement, retraitEnVigueur } from "./ecartes-non-reinscrits.js";

export const ID_RAPPEL = "rappel-non-reinscrits";

// Texte de la notification push, composé par le serveur — qui ne connaît pas
// la langue de chaque appareil : en français. La cloche, elle, traduit
// (shell.notif.reinsc*). `dateRetrait` : libelleDateRetrait.
export function texteRappel(nombre, dateRetrait) {
  const s = nombre > 1 ? "s" : "";
  return {
    titre: `📝 ${nombre} élève${s} non réinscrit${s}`, // i18n-ignore
    corps: `Aucun paiement depuis la rentrée${dateRetrait ? ` : retiré${s} des classes ${dateRetrait}` : ""}. Faites-les réinscrire.`, // i18n-ignore
  };
}

// Rappel du moment, ou null (règle pas encore en vigueur, aucun non
// réinscrit). `eleves` : élèves ACTIFS de l'école, toutes sections.
// `annee` : l'année officielle (repli de l'appareil si l'école n'en a pas).
// Le texte est composé à l'affichage (NotificationsMenu, traduit).
export function rappelNonReinscrits(eleves = [], schoolInfo = {}, { annee = schoolInfo?.anneeScolaire, maintenant = new Date() } = {}) {
  if (!retraitEnVigueur(schoolInfo, annee, maintenant)) return null;
  const nombre = eleves.filter(estNonReinscritSansPaiement).length;
  if (!nombre) return null;
  return {
    id: ID_RAPPEL, rappel: true, nombre, dateRetrait: dateRetraitEcole(schoolInfo, annee), date: maintenant.getTime(),
  };
}

// Jour local « AAAA-MM-JJ ».
export const jourLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const cleVu = (schoolId) => `LC_rappelReinscVu_${schoolId}`;

// Le rappel a-t-il déjà été vu aujourd'hui sur cet appareil ?
export function rappelVuAujourdhui(schoolId, maintenant = new Date(), stockage = globalThis.localStorage) {
  try { return stockage?.getItem(cleVu(schoolId)) === jourLocal(maintenant); } catch { return false; }
}

export function marquerRappelVu(schoolId, maintenant = new Date(), stockage = globalThis.localStorage) {
  try { stockage?.setItem(cleVu(schoolId), jourLocal(maintenant)); } catch { /* navigation privée */ }
}
