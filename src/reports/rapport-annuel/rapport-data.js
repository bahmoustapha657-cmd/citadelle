// ══════════════════════════════════════════════════════════════
//  Rapport annuel — agrégation des données (calculs purs)
// ══════════════════════════════════════════════════════════════
// Consolide effectifs, finances, mensualités, masse salariale, absences
// et performance pédagogique à partir des collections de l'année. Aucune
// dépendance au DOM : ne renvoie qu'un modèle exploité par le gabarit HTML.
// Les sections d'agrégation vivent dans ./rapport-calculs.

import { MOIS_ANNEE, getAnnee } from "../../constants.js";
import {
  computeEffectifs,
  computeFinances,
  computeRecouvrement,
  computeAbsences,
  computePedagogie,
  computeMensParClasse,
  computeSalairesSection,
} from "./rapport-calculs.js";

// data = { annee, moisAnnee, eleves[], absences[], notes[], recettes[],
//          depenses[], salaires[], ensC[], ensL[], ensP[] }
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
  } = data;

  const elevesActifs = eleves.filter((e) => e.statut === "Actif");

  return {
    annee, moisAnnee,
    ...computeEffectifs(elevesActifs, { ensC, ensL, ensP }),
    ...computeFinances(moisAnnee, { recettes, depenses, salaires }),
    ...computeRecouvrement(elevesActifs, moisAnnee),
    ...computeAbsences(absences, elevesActifs),
    ...computePedagogie(elevesActifs, notes),
    ...computeMensParClasse(elevesActifs, moisAnnee),
    ...computeSalairesSection(salaires),
  };
};
