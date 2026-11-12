// ══════════════════════════════════════════════════════════════
//  Portail Enseignant — appel de la classe (logique pure)
// ══════════════════════════════════════════════════════════════
// L'appel n'a pas de table à lui : un élève est présent tant qu'aucune
// Absence ni aucun Retard n'est signalé pour lui ce jour-là (table
// `absences`). Faire l'appel revient donc à comparer ce que l'enseignant a
// coché avec ce qui est déjà enregistré, et à n'écrire que la différence —
// enregistrer deux fois le même appel n'écrit rien la seconde fois.
//
// Au secondaire, l'appel se fait par COURS (`seance` : heureDebut, heureFin,
// matiere ; voir seances.js) : seuls les signalements de ce cours comptent
// pour cet appel. Ceux des autres cours du jour (et ceux sans heure, valables
// toute la journée) sont montrés pour information sans rien bloquer : un élève
// absent en Maths à 8 h peut être présent en Français à 10 h.
import { dateIso } from "../../absences-eleves.js";
import { cleSeance, libelleSeance } from "./seances.js";

// i18n-ignore
export const TYPE_PAR_ETAT = { absent: "Absence", retard: "Retard" };
const ETAT_PAR_TYPE = { Absence: "absent", Retard: "retard" };

// Ce qui est déjà enregistré pour `date` : Map eleveId → { etat, incidents,
// modifiable, auteur }. Une absence l'emporte sur un retard du même jour.
// `modifiable` : tous ces signalements sont ceux de l'enseignant — celui de
// la direction ou d'un collègue ne se défait pas depuis l'appel.
// `seance` : appel d'un cours (secondaire) ; null : appel de la journée.
const duCours = (inc, seance) => !seance || cleSeance(inc) === cleSeance(seance);

export function situationDuJour(incidents = [], date = "", enseignantId = null, seance = null) {
  const parEleve = new Map();
  for (const inc of incidents) {
    const etat = ETAT_PAR_TYPE[inc.type];
    if (!etat || !inc.eleveId || dateIso(inc.date) !== date || !duCours(inc, seance)) continue;
    const deja = parEleve.get(inc.eleveId) || { etat, incidents: [], modifiable: true, auteur: "" };
    if (etat === "absent") deja.etat = "absent";
    deja.incidents.push(inc);
    const mien = Boolean(enseignantId) && inc.signaledByEnseignantId === enseignantId;
    if (!mien) {
      deja.modifiable = false;
      deja.auteur = deja.auteur || inc.signaledByEnseignantNom || "";
    }
    parEleve.set(inc.eleveId, deja);
  }
  return parEleve;
}

// État affiché d'un élève : ce que l'enseignant vient de cocher, sinon ce qui
// est enregistré, sinon présent. Un signalement d'un autre ne se recoche pas.
export function etatEleve(eleveId, situation, marques = {}) {
  const enregistre = situation.get(eleveId);
  if (enregistre && !enregistre.modifiable) return enregistre.etat;
  return marques[eleveId] || enregistre?.etat || "present";
}

export function compterAppel(eleves = [], situation, marques = {}) {
  const total = { presents: 0, absents: 0, retards: 0 };
  for (const e of eleves) {
    const etat = etatEleve(e._id, situation, marques);
    if (etat === "absent") total.absents += 1;
    else if (etat === "retard") total.retards += 1;
    else total.presents += 1;
  }
  return total;
}

// Écritures à faire pour que la base dise ce que l'enseignant a coché :
//  · creations     : élève présent en base, coché absent ou en retard ;
//  · modifications : absent ↔ retard (le signalement garde motif et justificatif) ;
//  · suppressions  : élève recoché présent (et doublons du même jour).
export function planAppel({ eleves = [], incidents = [], date = "", marques = {}, enseignantId = null, seance = null }) {
  const situation = situationDuJour(incidents, date, enseignantId, seance);
  const plan = { creations: [], modifications: [], suppressions: [] };
  for (const e of eleves) {
    const voulu = marques[e._id];
    if (!voulu) continue;
    const enregistre = situation.get(e._id);
    if (enregistre && !enregistre.modifiable) continue;
    const actuel = enregistre?.etat || "present";
    if (voulu === actuel) continue;
    if (!enregistre) {
      plan.creations.push({ eleveId: e._id, eleveNom: `${e.nom || ""} ${e.prenom || ""}`.trim(), type: TYPE_PAR_ETAT[voulu] });
    } else if (voulu === "present") {
      plan.suppressions.push(...enregistre.incidents.map((inc) => inc._id));
    } else {
      const [premier, ...doublons] = enregistre.incidents;
      plan.modifications.push({ incident: premier, type: TYPE_PAR_ETAT[voulu] });
      plan.suppressions.push(...doublons.map((inc) => inc._id));
    }
  }
  return plan;
}

// Ce que les AUTRES cours du jour disent d'un élève (appel par cours) :
// Map eleveId → [{ etat, quand, matiere, auteur }], dans l'ordre de la
// journée. `quand` : « 08:00–10:00 », vide pour un signalement de la journée.
export function autresCoursDuJour(incidents = [], date = "", seance = null) {
  const parEleve = new Map();
  if (!seance) return parEleve;
  for (const inc of incidents) {
    const etat = ETAT_PAR_TYPE[inc.type];
    if (!etat || !inc.eleveId || dateIso(inc.date) !== date || duCours(inc, seance)) continue;
    const liste = parEleve.get(inc.eleveId) || [];
    liste.push({ etat, quand: libelleSeance(inc), matiere: inc.matiere || "", auteur: inc.signaledByEnseignantNom || "" });
    parEleve.set(inc.eleveId, liste);
  }
  for (const liste of parEleve.values()) liste.sort((a, b) => a.quand.localeCompare(b.quand));
  return parEleve;
}

export const nbEcritures = (plan) =>
  plan.creations.length + plan.modifications.length + plan.suppressions.length;

// ── « Appel fait à 08:12 » ──────────────────────────────────────────────────
// Un appel où tout le monde est présent n'écrit rien en base : l'heure du
// dernier appel validé est gardée sur l'appareil, pour que l'enseignant voie
// qu'il l'a déjà fait.
const CLE_FAITS = "LC_appels_faits";
const MAX_FAITS = 80;
const cleFait = (ownerId, classe, date) => `${ownerId}|${classe}|${date}`;

function lireFaits(stockage) {
  try {
    const faits = JSON.parse(stockage.getItem(CLE_FAITS) || "{}");
    return faits && typeof faits === "object" ? faits : {};
  } catch {
    return {};
  }
}

export function heureAppelFait(ownerId, classe, date, stockage = globalThis.localStorage) {
  if (!stockage) return "";
  return lireFaits(stockage)[cleFait(ownerId, classe, date)] || "";
}

export function noterAppelFait(ownerId, classe, date, heure, stockage = globalThis.localStorage) {
  if (!stockage) return;
  try {
    const faits = lireFaits(stockage);
    delete faits[cleFait(ownerId, classe, date)];
    faits[cleFait(ownerId, classe, date)] = heure;
    const cles = Object.keys(faits);
    for (const cle of cles.slice(0, Math.max(0, cles.length - MAX_FAITS))) delete faits[cle];
    stockage.setItem(CLE_FAITS, JSON.stringify(faits));
  } catch {
    // Stockage plein ou interdit : l'appel est enregistré, seule l'heure manque.
  }
}
