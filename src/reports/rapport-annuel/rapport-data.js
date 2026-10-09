// ══════════════════════════════════════════════════════════════
//  Rapport annuel — agrégation des données (calculs purs)
// ══════════════════════════════════════════════════════════════
// Consolide effectifs, finances, mensualités, masse salariale, absences
// et performance pédagogique à partir des collections de l'année. Aucune
// dépendance au DOM : ne renvoie qu'un modèle exploité par le gabarit HTML.
// Les sections d'agrégation vivent dans ./rapport-calculs.

import { MOIS_ANNEE, anneeScolaireDeDate, getAnnee } from "../../constants.js";
import {
  computeEffectifs,
  computeFinances,
  computeRecouvrement,
  computeAbsences,
  computePedagogie,
  computeMensParClasse,
  computeSalairesSection,
} from "./rapport-calculs.js";

// Le rapport ne porte que sur SON année. Le tableau de bord lui transmet
// recettes, dépenses, fiches de paie et absences de toutes les années (ses
// tuiles en font un cumul) : sans ce tri, « Oct » additionnait octobre 2025 et
// octobre 2026. Notes, recettes, dépenses et fiches de paie portent leur année
// (celle qui filtre aussi la comptabilité) ; une absence n'a que sa date, ISO
// ou JJ/MM/AAAA — une date illisible ne se rattache à aucune année.
const deLAnnee = (annee) => (x) => x.annee === annee;
const absenceDeLAnnee = (annee) => (a) =>
  anneeScolaireDeDate(String(a.date ?? "").trim().slice(0, 10)) === annee;

// data = { annee, moisAnnee, eleves[], absences[], notes[], recettes[],
//          depenses[], salaires[], ensC[], ensL[], ensP[], ensPre[] }
export const computeRapportAnnuel = (data = {}) => {
  const {
    annee = getAnnee(),
    moisAnnee = MOIS_ANNEE,
    eleves = [],
    absences = [],
    notes = [],
    recettes = [],
    depenses = [],
    salaires = [],
    ensC = [],
    ensL = [],
    ensP = [],
    ensPre = [],
  } = data;

  const elevesActifs = eleves.filter((e) => e.statut === "Actif");
  const dansLAnnee = deLAnnee(annee);
  const salairesAnnee = salaires.filter(dansLAnnee);

  return {
    annee, moisAnnee,
    ...computeEffectifs(elevesActifs, { ensC, ensL, ensP, ensPre }),
    ...computeFinances(moisAnnee, {
      recettes: recettes.filter(dansLAnnee),
      depenses: depenses.filter(dansLAnnee),
      salaires: salairesAnnee,
    }),
    ...computeRecouvrement(elevesActifs, moisAnnee),
    ...computeAbsences(absences.filter(absenceDeLAnnee(annee)), elevesActifs),
    ...computePedagogie(elevesActifs, notes.filter(dansLAnnee)),
    ...computeMensParClasse(elevesActifs, moisAnnee),
    ...computeSalairesSection(salairesAnnee),
  };
};
