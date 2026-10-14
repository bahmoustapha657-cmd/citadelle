// Alerte mensualités : élèves en retard sur des mois DÉJÀ ÉCHUS. L'ancienne
// règle comptait les mois à venir (« 9 impayés » dès octobre) et ne regardait
// que la série d'impayés en FIN d'année — or le premier versement coche le
// dernier mois (ordre d'encaissement) : un seul paiement faisait sortir
// l'élève de l'alerte pour toute l'année.
// Aucune dépendance React : entièrement testable en isolation.
import { TOUS_MOIS_COURTS, TOUS_MOIS_LONGS } from "../../../constants.js";
import { moisExigibles } from "../../../depart-utils.js";
import {
  acompteMois, getTarifMensuelForClasse, montantDuMois,
} from "../../../mensualite-utils.js";
import { estExonereTotal } from "../../../exoneration-utils.js";

// Réglages par défaut : un mois compte dès son 1er jour, alerte à 2 mois.
export const ALERTE_DEFAUT = Object.freeze({ jourEcheance: 1, seuilMois: 2 });
export const JOUR_ECHEANCE_MAX = 28;
export const SEUIL_MOIS_MAX = 12;

const entierEntre = (valeur, min, max) => {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

// Réglages de l'école, bornés comme côté serveur (maj_reglages_compta).
export function reglagesAlerte(schoolInfo = {}) {
  const r = schoolInfo?.alerteMensualites || {};
  return {
    jourEcheance: entierEntre(r.jourEcheance, 1, JOUR_ECHEANCE_MAX) ?? ALERTE_DEFAUT.jourEcheance,
    seuilMois: entierEntre(r.seuilMois, 1, SEUIL_MOIS_MAX) ?? ALERTE_DEFAUT.seuilMois,
  };
}

// Jour d'échéance du mois `mois` (« Oct » ou « Octobre ») de l'année scolaire
// « AAAA-AAAA » : septembre → décembre en AAAA, janvier → août en AAAA+1.
// null si l'année ou le mois ne se lisent pas.
export function echeanceDuMois(mois, annee, jourEcheance = 1) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(annee || "").trim());
  const court = TOUS_MOIS_COURTS.indexOf(mois);
  const rang = court >= 0 ? court : TOUS_MOIS_LONGS.indexOf(mois);
  if (!m || rang < 0) return null;
  return new Date(Number(m[1]), 8 + rang, jourEcheance);
}

// Mois de `moisAnnee` dont l'échéance est passée à la date `aujourdhui`.
// Année illisible : on ne sait pas dater, aucun mois n'est échu (pas de
// fausse alerte).
export function moisEchus(moisAnnee = [], annee, jourEcheance = 1, aujourdhui = new Date()) {
  return moisAnnee.filter((mois) => {
    const echeance = echeanceDuMois(mois, annee, jourEcheance);
    return !!echeance && echeance <= aujourdhui;
  });
}

// Retard d'un élève : mois échus qu'il devait (départ, absence non due et
// dispense déduits) et pas encore soldés, avec le reste à payer, acomptes
// déduits.
export function retardEleve(eleve = {}, { moisAnnee = [], annee, tarifsClasses = [], jourEcheance = 1, aujourdhui = new Date() } = {}) {
  if (estExonereTotal(eleve, "mensualites")) return { mois: [], montant: 0 };
  const mens = eleve.mens || {};
  const echus = new Set(moisEchus(moisAnnee, annee, jourEcheance, aujourdhui));
  const du = montantDuMois(eleve, getTarifMensuelForClasse(tarifsClasses, eleve.classe));
  const mois = [];
  let montant = 0;
  for (const m of moisExigibles(eleve, moisAnnee, annee)) {
    if (!echus.has(m) || mens[m] === "Payé") continue;
    const reste = Math.max(0, du - acompteMois(eleve, m));
    // Tarif inconnu (0) : le mois reste signalé, sans montant.
    if (du > 0 && reste === 0) continue;
    mois.push(m);
    montant += reste;
  }
  return { mois, montant };
}

// Élèves ayant au moins `seuilMois` mois échus impayés, les plus en retard
// d'abord (nombre de mois, puis montant).
export function elevesEnRetard(eleves = [], { reglages = ALERTE_DEFAUT, ...options } = {}) {
  return eleves
    .map((eleve) => ({ eleve, ...retardEleve(eleve, { ...options, jourEcheance: reglages.jourEcheance }) }))
    .filter((r) => r.mois.length >= reglages.seuilMois)
    .sort((a, b) => b.mois.length - a.mois.length || b.montant - a.montant);
}
