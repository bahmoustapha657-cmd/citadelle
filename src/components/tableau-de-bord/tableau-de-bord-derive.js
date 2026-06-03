// Calculs purs du tableau de bord : indicateurs consolidés (taux de
// paiement, masse salariale, finances, tendances mensuelles, événements).
// Aucune dépendance React/Firestore — entièrement testable en isolation.

// Taux de paiement des mensualités pour un groupe d'élèves.
export function calcTauxPaiement(eleves) {
  if (!eleves.length) return 0;
  const mois = Object.keys(eleves[0]?.mens || {});
  if (!mois.length) return 0;
  const total = eleves.length * mois.length;
  const payes = eleves.reduce((s, e) => s + Object.values(e.mens || {}).filter((v) => v === "Payé").length, 0);
  return total > 0 ? Math.round(payes / total * 100) : 0;
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

// Tendance mensuelle : taux de paiement + absences mois par mois.
export function computeTendance(moisAnnee, tousEleves, absencesAll) {
  return moisAnnee.map((m) => {
    const payesMois = tousEleves.filter((e) => (e.mens || {})[m] === "Payé").length;
    const taux = tousEleves.length ? Math.round(payesMois / tousEleves.length * 100) : 0;
    const absencesMois = absencesAll.filter((a) => {
      try { return new Date(a.date).toLocaleDateString("fr-FR", { month: "long" }).toLowerCase() === m.toLowerCase(); } catch { return false; }
    }).length;
    return { mois: m.slice(0, 3), taux, absences: absencesMois, payes: payesMois };
  });
}
