// Logique métier des salaires extraite de Comptabilite.jsx (découpage 2026-05-29).
// Regroupe l'état dérivé (filtrage par mois/section, totaux) et les actions
// (génération auto, application des bons, impression) du domaine paie.

import { imprimerEtatsSalaires } from "../../reports";
import { autoGenererSalairesAction, genererSalairesPourMois } from "./salary-actions";
import { appliquerBons as appliquerBonsAction } from "./payment-actions";
import {
  getForfaitNet,
  getSalaryExecutionHours,
  getSalaryMontantBrut,
  getSalaryNet,
  summarizeSalaryTotals,
} from "../../salary-utils";

export function useComptaSalaires({
  salaires,
  bons,
  moisSel,
  moisSalaire,
  ensCollege,
  ensLycee,
  ensPrimaire,
  personnel,
  emploisCollege,
  emploisLycee,
  engCollege,
  engLycee,
  primeDefaut,
  annee,
  anneeConsultee,
  schoolInfo,
  modS,
  ajS,
  supS,
  readOnly,
  toast,
  logAction,
}) {
  const moisLabel = moisSel === "__TOUS__" ? "Tous les mois (prévision)" : moisSel;
  const moisModale = moisSel === "__TOUS__" ? (moisSalaire[0] || "Octobre") : moisSel;
  const salairesMois = moisSel === "__TOUS__" ? [] : salaires.filter((s) => s.mois === moisSel);
  const salairesSec = salairesMois.filter((s) => s.section === "Secondaire");
  const salairesPrim = salairesMois.filter((s) => s.section === "Primaire");
  const salairesPers = salairesMois.filter((s) => s.section === "Personnel");
  const bonsMois = bons.filter((b) => b.mois === moisSel);

  const appliquerBons = () => appliquerBonsAction({
    moisSel, bonsMois, salairesMois, readOnly, toast, modS,
  });

  const calcExecute = (salary) => getSalaryExecutionHours(salary);
  const calcMontant = (salary) => getSalaryMontantBrut(salary);
  const calcNet = (salary) => getSalaryNet(salary);
  const calcNetF = (salary) => getForfaitNet(salary);
  const totalsSec = summarizeSalaryTotals(salairesSec);
  const totalsPrim = summarizeSalaryTotals(salairesPrim);
  const totalsPers = summarizeSalaryTotals(salairesPers);
  const totNetSec = totalsSec.net;
  const totMontantSec = totalsSec.montant;
  const totBonSec = totalsSec.bon;
  const totNetPrim = totalsPrim.net;
  const totMontantPrim = totalsPrim.montant;
  const totBonPrim = totalsPrim.bon;
  const totNetPers = totalsPers.net;
  const totMontantPers = totalsPers.montant;
  const totBonPers = totalsPers.bon;
  const totMontantGlobal = totalsSec.montant + totalsPrim.montant + totalsPers.montant;
  const totBonGlobal = totalsSec.bon + totalsPrim.bon + totalsPers.bon;
  const totNetGlobal = totalsSec.net + totalsPrim.net + totalsPers.net;

  // Wrapper qui passe l'état React à la fonction pure salary-actions.
  // La logique métier (dédup, génération, resync) vit dans le helper ;
  // ici on injecte juste les datasets + mutators Firestore.
  const genererPourMois = (mois, { resync = false } = {}) => genererSalairesPourMois(mois, {
    salaires,
    ensCollege, ensLycee, ensPrimaire, personnel,
    emploisCollege, emploisLycee, engCollege, engLycee,
    primeDefaut,
    annee: annee || anneeConsultee,
    modS, ajS, supS,
    resync,
  });

  // Délègue à autoGenererSalairesAction (UI-coupled mais découplé du
  // parent : il reçoit toast/confirm/logAction par injection).
  const autoGenererSalaires = (opts = {}) => {
    if (readOnly) return;
    return autoGenererSalairesAction({
      ...opts,
      moisSel, moisSalaire, genererPourMois,
      ensCollege, ensLycee, ensPrimaire, personnel, primeDefaut,
      toast, confirm, logAction,
    });
  };

  // Wrapper qui rassemble l'état React et délègue le rendu HTML au helper
  // src/reports/etats-salaires.js. La fonction d'impression elle-même
  // (~170 LOC de template) vit avec les autres documents imprimables.
  const imprimerSalaires = () => {
    if (moisSel === "__TOUS__") { toast("Sélectionnez un mois précis pour imprimer.", "warning"); return; }
    imprimerEtatsSalaires({
      moisSel, anneeConsultee, schoolInfo,
      salairesSec, salairesPrim, salairesPers,
      totals: {
        totMontantGlobal, totBonGlobal, totNetGlobal,
        totMontantSec, totBonSec, totNetSec,
        totMontantPrim, totBonPrim, totNetPrim,
        totMontantPers, totBonPers, totNetPers,
      },
      calcExecute, calcMontant, calcNet,
    });
  };

  return {
    moisLabel,
    moisModale,
    salairesMois,
    salairesSec,
    salairesPrim,
    salairesPers,
    bonsMois,
    appliquerBons,
    calcExecute,
    calcMontant,
    calcNet,
    calcNetF,
    totNetSec,
    totNetPrim,
    totNetPers,
    autoGenererSalaires,
    imprimerSalaires,
  };
}
