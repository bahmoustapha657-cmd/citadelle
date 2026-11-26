// Situation générale des paiements, imprimée depuis l'onglet Mensualités :
// pour chaque élève, une case par mois de l'année et ce qu'il a payé dans
// l'année ; pour chaque classe (et toutes classes réunies), les statistiques :
// à jour / en retard, mois par mois combien ont payé, versé un acompte, sont
// en retard ou ne doivent pas encore, ce qui a été encaissé, puis
// l'inscription, les frais annexes et le total encaissé. Même périmètre que
// la grille (section ou « Tout », classe), non réinscrits retirés exclus.
// Mise en page : reports/listes-mensualites.js (situationGeneraleHTML).
// Aucune dépendance React : testable en isolation.
import { moisExigibles } from "../../../depart-utils.js";
import { estExonereTotal } from "../../../exoneration-utils.js";
import {
  acompteMois, getEleveMensualiteSnapshot, getTarifMensuelForClasse, montantMoisPaye,
} from "../../../mensualite-utils.js";
import { MOIS_GARANTIE_DEFAUT } from "../../../paiements-scolarite.js";
import { retardEleve } from "./alerte-mensualites.js";
import { grouperParClasse } from "./liste-mois.js";

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
 * `montant` de chaque case : ce qui a été encaissé sur le mois (mensualité
 * au tarif figé, ou l'acompte). `enRetard` : au moins un mois impayé.
 * Inscription (`etatInscription`) : payee, acompte (une partie versée),
 * nonpayee (encore due), nondue (dispense, départ avant l'année, tarif nul).
 * Montants encaissés dans l'année — mêmes chiffres que la grille :
 * `mensualites` (acomptes compris), `inscription`, `annexes`,
 * `autres` (inscription + annexes), `total`.
 */
export function situationEleve(eleve = {}, {
  moisAnnee = [], annee, tarifsClasses = [], jourEcheance = 1, aujourdhui = new Date(), moisGarantie = MOIS_GARANTIE_DEFAUT,
} = {}) {
  const mens = eleve.mens || {};
  const tarif = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  const exigibles = new Set(estExonereTotal(eleve, "mensualites") ? [] : moisExigibles(eleve, moisAnnee, annee));
  const retard = retardEleve(eleve, { moisAnnee, annee, tarifsClasses, jourEcheance, aujourdhui, moisGarantie });
  const impayes = new Set(retard.mois);
  const cases = moisAnnee.map((mois) => {
    if (mens[mois] === "Payé") return { mois, etat: "paye", acompte: 0, montant: montantMoisPaye(eleve, mois, tarif) };
    const acompte = acompteMois(eleve, mois);
    if (acompte > 0) return { mois, etat: "acompte", acompte, montant: acompte };
    if (!exigibles.has(mois)) return { mois, etat: "nondu", acompte: 0, montant: 0 };
    return { mois, etat: impayes.has(mois) ? "impaye" : "avenir", acompte: 0, montant: 0 };
  });
  const s = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses, annee);
  const inscription = s.montantInscriptionPercu;
  const annexes = s.montantAutrePercu;
  return {
    eleve,
    cases,
    moisPayes: cases.filter((c) => c.etat === "paye").length,
    moisRetard: retard.mois.length,
    enRetard: retard.mois.length > 0,
    etatInscription: eleve.inscriptionPayee ? "payee"
      : inscription > 0 ? "acompte"
        : s.soldeInscription > 0 ? "nonpayee" : "nondue",
    mensualites: s.montantMensualitesPercu,
    inscription,
    annexes,
    autres: inscription + annexes,
    total: s.montantMensualitesPercu + inscription + annexes,
  };
}

// Lignes de la situation, dans l'ordre de `eleves`, filtrées.
export function lignesSituation(eleves = [], { filtre = "tous", ...options } = {}) {
  return eleves
    .map((eleve) => situationEleve(eleve, options))
    .filter((l) => (filtre === "retard" ? l.enRetard : filtre === "ajour" ? !l.enRetard : true));
}

const moisVide = () => ({ paye: 0, acompte: 0, impaye: 0, avenir: 0, nondu: 0, montant: 0 });

/**
 * Statistiques d'un groupe d'élèves (une classe, ou toutes) :
 *  • effectif, à jour / en retard ;
 *  • parMois : nombre d'élèves ayant soldé chaque mois (ordre de l'année) ;
 *  • statsMois : pour chaque mois, nombre d'élèves par état de la case
 *    (paye, acompte, impaye, avenir, nondu) et `montant` encaissé ;
 *  • moisPayes / acomptes : nombre de mois soldés / avec acompte, tous élèves ;
 *  • inscription : nombre d'élèves par état (payee, acompte, nonpayee,
 *    nondue) et `montant` encaissé ;
 *  • mensualites, annexes, autres, total : montants encaissés.
 */
export function totauxSituation(lignes = []) {
  const t = {
    effectif: lignes.length, aJour: 0, enRetard: 0, parMois: [], statsMois: [], moisPayes: 0, acomptes: 0,
    inscription: { payee: 0, acompte: 0, nonpayee: 0, nondue: 0, montant: 0 },
    mensualites: 0, annexes: 0, autres: 0, total: 0,
  };
  for (const l of lignes) {
    if (l.enRetard) t.enRetard += 1; else t.aJour += 1;
    l.cases.forEach((c, i) => {
      t.parMois[i] = (t.parMois[i] || 0) + (c.etat === "paye" ? 1 : 0);
      if (!t.statsMois[i]) t.statsMois[i] = moisVide();
      t.statsMois[i][c.etat] += 1;
      t.statsMois[i].montant += c.montant || 0;
    });
    t.moisPayes += l.moisPayes;
    t.acomptes += l.cases.filter((c) => c.etat === "acompte").length;
    t.inscription[l.etatInscription] += 1;
    t.inscription.montant += l.inscription;
    t.mensualites += l.mensualites;
    t.annexes += l.annexes;
    t.autres += l.autres;
    t.total += l.total;
  }
  return t;
}

// Situation rangée par classe (ordre des niveaux), avec les totaux de chaque classe.
export const grouperSituation = (lignes = []) => grouperParClasse(lignes, totauxSituation);

// Totaux de toutes les classes réunies.
export const totalSituation = (groupes = []) => totauxSituation(groupes.flatMap((g) => g.lignes));
