// Alerte mensualités : élèves en retard sur des mois DÉJÀ ÉCHUS. L'ancienne
// règle comptait les mois à venir (« 9 impayés » dès octobre) et ne regardait
// que la série d'impayés en FIN d'année — or le premier versement coche le
// dernier mois (ordre d'encaissement) : un seul paiement faisait sortir
// l'élève de l'alerte pour toute l'année.
// Aucune dépendance React : entièrement testable en isolation.
import { TOUS_MOIS_COURTS, TOUS_MOIS_LONGS, aReinscrire } from "../../../constants.js";
import { moisExigibles } from "../../../depart-utils.js";
import {
  acompteInscription, acompteMois, getTarifInscriptionForEleve, getTarifMensuelForClasse,
  montantDuInscription, montantDuMois, montantMoisPaye,
} from "../../../mensualite-utils.js";
import { estExonereTotal } from "../../../exoneration-utils.js";
import { MOIS_GARANTIE_DEFAUT, moisDeGarantie } from "../../../paiements-scolarite.js";

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
// Les mois de garantie (derniers de l'année, payés d'avance) sont dus dès
// l'échéance du PREMIER mois : Juin non payé est en retard dès octobre.
// Année illisible : on ne sait pas dater, aucun mois n'est échu (pas de
// fausse alerte).
export function moisEchus(moisAnnee = [], annee, jourEcheance = 1, aujourdhui = new Date(), moisGarantie = MOIS_GARANTIE_DEFAUT) {
  const garantie = moisDeGarantie(moisAnnee, moisGarantie);
  const echu = (mois) => {
    const echeance = echeanceDuMois(mois, annee, jourEcheance);
    return !!echeance && echeance <= aujourdhui;
  };
  const rentreeEchue = moisAnnee.length > 0 && echu(moisAnnee[0]);
  return moisAnnee.filter((mois) => echu(mois) || (rentreeEchue && garantie.includes(mois)));
}

// Retard d'un élève : mois échus qu'il devait (départ, absence non due et
// dispense déduits) et pas encore soldés, avec le reste à payer, acomptes
// déduits.
export function retardEleve(eleve = {}, {
  moisAnnee = [], annee, tarifsClasses = [], jourEcheance = 1, aujourdhui = new Date(), moisGarantie = MOIS_GARANTIE_DEFAUT,
} = {}) {
  if (estExonereTotal(eleve, "mensualites")) return { mois: [], montant: 0 };
  const mens = eleve.mens || {};
  const echus = new Set(moisEchus(moisAnnee, annee, jourEcheance, aujourdhui, moisGarantie));
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

// ── Listes imprimables de l'alerte ──────────────────────────────

// Élèves ayant payé au moins un mois : les mois soldés (ordre de l'année),
// les acomptes en cours sur les autres, et ce qui a été perçu sur les
// mensualités (tarif figé au paiement, acomptes compris).
export function elevesAyantPaye(eleves = [], { moisAnnee = [], tarifsClasses = [] } = {}) {
  const lignes = [];
  for (const eleve of eleves) {
    const mens = eleve.mens || {};
    const tarif = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
    const mois = moisAnnee.filter((m) => mens[m] === "Payé");
    if (!mois.length) continue;
    const acomptes = moisAnnee
      .filter((m) => mens[m] !== "Payé" && acompteMois(eleve, m) > 0)
      .map((m) => ({ mois: m, montant: acompteMois(eleve, m) }));
    const montant = mois.reduce((s, m) => s + montantMoisPaye(eleve, m, tarif), 0)
      + acomptes.reduce((s, a) => s + a.montant, 0);
    lignes.push({ eleve, mois, acomptes, montant });
  }
  return lignes;
}

// Tri de la liste « Ont payé », choisi à l'impression : critère puis sens.
// À égalité, les autres critères départagent (mois, montant, nom) — l'ordre
// reste le même d'une impression à l'autre.
export const TRIS_AYANT_PAYE = [
  { id: "mois", label: "Nombre de mois payés" },
  { id: "montant", label: "Montant perçu" },
  { id: "nom", label: "Nom de l'élève" },
];
export const TRI_AYANT_PAYE_DEFAUT = Object.freeze({ critere: "mois", sens: "desc" });

const nomComplet = (eleve = {}) => `${eleve.nom || ""} ${eleve.prenom || ""}`.trim();
const COMPARER_AYANT_PAYE = {
  mois: (a, b) => a.mois.length - b.mois.length,
  montant: (a, b) => a.montant - b.montant,
  nom: (a, b) => nomComplet(a.eleve).localeCompare(nomComplet(b.eleve), "fr", { sensitivity: "base", numeric: true }),
};

export function trierAyantPaye(lignes = [], { critere = TRI_AYANT_PAYE_DEFAUT.critere, sens = TRI_AYANT_PAYE_DEFAUT.sens } = {}) {
  const principal = COMPARER_AYANT_PAYE[critere] || COMPARER_AYANT_PAYE[TRI_AYANT_PAYE_DEFAUT.critere];
  const signe = sens === "asc" ? 1 : -1;
  const departage = ["mois", "montant", "nom"].filter((c) => COMPARER_AYANT_PAYE[c] !== principal);
  return [...lignes].sort((a, b) => signe * principal(a, b)
    // Départage : nombres dans le même sens, noms toujours de A à Z.
    || departage.reduce((r, c) => r || (c === "nom" ? 1 : signe) * COMPARER_AYANT_PAYE[c](a, b), 0));
}

// Libellé du tri, imprimé sous le titre de la liste.
export const libelleTriAyantPaye = ({ critere, sens } = TRI_AYANT_PAYE_DEFAUT) => {
  const tri = TRIS_AYANT_PAYE.find((t) => t.id === critere) || TRIS_AYANT_PAYE[0];
  const ordre = tri.id === "nom" ? (sens === "asc" ? "de A à Z" : "de Z à A") : (sens === "asc" ? "croissant" : "décroissant");
  return `${tri.label}, ${ordre}`;
};

// Élèves présents (statut « Actif ») dont l'inscription ou la réinscription
// de l'année n'est pas encaissée — même règle que le filtre « À réinscrire »
// de l'enrôlement. Dispensé de toute l'inscription : rien à réclamer, il
// n'y figure pas. `moisPayes` : preuve qu'il fréquente déjà l'école.
export function elevesNonReinscrits(eleves = [], { moisAnnee = [], tarifsClasses = [] } = {}) {
  return eleves
    .filter((eleve) => aReinscrire(eleve) && !estExonereTotal(eleve, "inscription"))
    .map((eleve) => {
      const du = montantDuInscription(eleve, getTarifInscriptionForEleve(eleve, tarifsClasses));
      const acompte = acompteInscription(eleve);
      return {
        eleve,
        type: eleve.typeInscription === "Réinscription" ? "Réinscription" : "Inscription",
        reste: Math.max(0, du - acompte),
        acompte,
        moisPayes: moisAnnee.filter((m) => (eleve.mens || {})[m] === "Payé").length,
      };
    });
}
