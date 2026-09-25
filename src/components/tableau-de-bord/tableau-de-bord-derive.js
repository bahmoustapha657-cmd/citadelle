// Calculs purs du tableau de bord : indicateurs consolidés (taux de
// paiement, masse salariale, finances, tendances mensuelles, événements).
// Aucune dépendance React/Firestore — entièrement testable en isolation.
import { moisExigibles } from "../../depart-utils.js";

// Taux de paiement des mensualités pour un groupe d'élèves : mois payés sur
// mois dus. Un élève parti ne doit que les mois entamés avant son départ
// (depart-utils) : il faisait baisser le taux avec des mois qu'il ne devait
// pas. `annee` : celle des fiches — sans elle, celle de l'écran.
export function calcTauxPaiement(eleves, annee) {
  if (!eleves.length) return 0;
  const mois = Object.keys(eleves[0]?.mens || {});
  if (!mois.length) return 0;
  let dus = 0;
  let payes = 0;
  for (const e of eleves) {
    const mens = e.mens || {};
    for (const m of moisExigibles(e, mois, annee)) {
      dus++;
      if (mens[m] === "Payé") payes++;
    }
  }
  return dus > 0 ? Math.round(payes / dus * 100) : 0;
}

// Net d'un salaire (base secondaire ou montant brut + bon + révision + forfait).
export function salaryNet(sal) {
  const baseSec = (sal.montantBrut !== undefined && sal.montantBrut !== null && Number.isFinite(Number(sal.montantBrut)))
    ? Number(sal.montantBrut)
    : Number(sal.vhExecute || 0) * Number(sal.primeHoraire || 0)
      + Number(sal.cinqSem || 0) * Number(sal.primeHoraire || 0);
  return baseSec
    + Number(sal.bon || 0)
    + Number(sal.revision || 0)
    + Number(sal.montantForfait || 0);
}

// Masse salariale = somme des nets des salaires du mois.
export function computeMasseSalariale(salMois) {
  return salMois.reduce((s, sal) => s + salaryNet(sal), 0);
}

// Finances consolidées : recettes, dépenses, solde.
export function computeFinances(recettes, depenses) {
  const totalRec = recettes.reduce((s, r) => s + Number(r.montant || 0), 0);
  const totalDep = depenses.reduce((s, d) => s + Number(d.montant || 0), 0);
  return { totalRec, totalDep, solde: totalRec - totalDep };
}

// Quatre prochains événements à venir (date >= aujourd'hui), triés.
export function computeEvenementsAVenir(evenements, today = new Date().toISOString().slice(0, 10)) {
  return evenements
    .filter((e) => e.date && e.date >= today)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(0, 4);
}

// Tendance mensuelle : taux de paiement + absences mois par mois. Le taux
// d'un mois porte sur les élèves qui le devaient (pas les partis d'avant).
export function computeTendance(moisAnnee, tousEleves, absencesAll, annee) {
  const dusParEleve = new Map(tousEleves.map((e) => [e, new Set(moisExigibles(e, moisAnnee, annee))]));
  return moisAnnee.map((m) => {
    const concernes = tousEleves.filter((e) => dusParEleve.get(e).has(m));
    const payesMois = concernes.filter((e) => (e.mens || {})[m] === "Payé").length;
    const taux = concernes.length ? Math.round(payesMois / concernes.length * 100) : 0;
    const absencesMois = absencesAll.filter((a) => {
      try { return new Date(a.date).toLocaleDateString("fr-FR", { month: "long" }).toLowerCase() === m.toLowerCase(); } catch { return false; }
    }).length;
    return { mois: m.slice(0, 3), taux, absences: absencesMois, payes: payesMois };
  });
}
