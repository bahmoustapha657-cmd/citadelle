// Situation générale des paiements, imprimée depuis l'onglet Mensualités :
// pour chaque élève, une case par mois de l'année et ce qu'il a payé dans
// l'année ; pour chaque classe, combien d'élèves sont à jour ou en retard,
// combien ont payé chaque mois, et ce que la classe a payé. Même périmètre
// que la grille (section ou « Tout », classe), non réinscrits retirés exclus.
// Mise en page : reports/listes-mensualites.js (situationGeneraleHTML).
// Aucune dépendance React : testable en isolation.
import { moisExigibles } from "../../../depart-utils.js";
import { estExonereTotal } from "../../../exoneration-utils.js";
import { acompteMois } from "../../../mensualite-utils.js";
import { MOIS_GARANTIE_DEFAUT } from "../../../paiements-scolarite.js";
import { retardEleve } from "./alerte-mensualites.js";
import { grouperParClasse, payeDansAnnee } from "./liste-mois.js";

// « eleves » : élève par élève, rangés par classe ; « classes » : le tableau
// des classes seul.
export const DETAILS_SITUATION = ["eleves", "classes"];
// Élèves gardés : tous, ceux qui ont au moins un mois échu impayé, les autres.
export const FILTRES_SITUATION = ["tous", "retard", "ajour"];

/**
 * Situation d'un élève. État de chaque mois :
 *  • paye : soldé ;
 *  • acompte : une partie versée (`acompte` = montant) ;
 *  • impaye : échu, dû et rien versé — exactement les mois de l'alerte
 *    mensualités (retardEleve : échéance de l'école, mois de garantie) ;
 *  • avenir : dû, mais son échéance n'est pas encore passée ;
 *  • nondu : après un départ, pendant une absence non due, ou dispense totale.
 * `enRetard` : au moins un mois impayé.
 */
export function situationEleve(eleve = {}, {
  moisAnnee = [], annee, tarifsClasses = [], jourEcheance = 1, aujourdhui = new Date(), moisGarantie = MOIS_GARANTIE_DEFAUT,
} = {}) {
  const mens = eleve.mens || {};
  const exigibles = new Set(estExonereTotal(eleve, "mensualites") ? [] : moisExigibles(eleve, moisAnnee, annee));
  const retard = retardEleve(eleve, { moisAnnee, annee, tarifsClasses, jourEcheance, aujourdhui, moisGarantie });
  const impayes = new Set(retard.mois);
  const cases = moisAnnee.map((mois) => {
    if (mens[mois] === "Payé") return { mois, etat: "paye", acompte: 0 };
    const acompte = acompteMois(eleve, mois);
    if (acompte > 0) return { mois, etat: "acompte", acompte };
    if (!exigibles.has(mois)) return { mois, etat: "nondu", acompte: 0 };
    return { mois, etat: impayes.has(mois) ? "impaye" : "avenir", acompte: 0 };
  });
  return {
    eleve,
    cases,
    moisPayes: cases.filter((c) => c.etat === "paye").length,
    moisRetard: retard.mois.length,
    enRetard: retard.mois.length > 0,
    ...payeDansAnnee(eleve, moisAnnee, tarifsClasses, annee),
  };
}

// Lignes de la situation, dans l'ordre de `eleves`, filtrées.
export function lignesSituation(eleves = [], { filtre = "tous", ...options } = {}) {
  return eleves
    .map((eleve) => situationEleve(eleve, options))
    .filter((l) => (filtre === "retard" ? l.enRetard : filtre === "ajour" ? !l.enRetard : true));
}

// Totaux d'un groupe d'élèves : effectif, à jour / en retard, nombre
// d'élèves ayant payé chaque mois (dans l'ordre de l'année), montants payés.
export function totauxSituation(lignes = []) {
  const t = { effectif: lignes.length, aJour: 0, enRetard: 0, parMois: [], mensualites: 0, autres: 0, total: 0 };
  for (const l of lignes) {
    if (l.enRetard) t.enRetard += 1; else t.aJour += 1;
    l.cases.forEach((c, i) => { t.parMois[i] = (t.parMois[i] || 0) + (c.etat === "paye" ? 1 : 0); });
    t.mensualites += l.mensualites;
    t.autres += l.autres;
    t.total += l.total;
  }
  return t;
}

// Situation rangée par classe (ordre des niveaux), avec les totaux de chaque classe.
export const grouperSituation = (lignes = []) => grouperParClasse(lignes, totauxSituation);

// Totaux de toutes les classes réunies.
export const totalSituation = (groupes = []) => totauxSituation(groupes.flatMap((g) => g.lignes));
