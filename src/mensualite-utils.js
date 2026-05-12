import {
  getDefaultMensualiteForClasse,
  getTarifAutreValue,
  getTarifMensuelTotal,
  getTarifRevisionValue,
} from "./constants.js";

// Bumper à chaque changement de formule (mensualité, solde, snapshot) qui
// rendrait les calculs antérieurs non reproductibles.
export const MENSUALITE_ALGO_VERSION = 1;

export function getTarifConfigForClasse(tarifsClasses = [], classe = "") {
  return tarifsClasses.find((tarif) => tarif.classe === classe) || null;
}

export function getTarifBaseForClasse(tarifsClasses = [], classe = "") {
  const tarif = getTarifConfigForClasse(tarifsClasses, classe);
  if (tarif) return Number(tarif.montant || 0);
  return getDefaultMensualiteForClasse(classe);
}

export function getTarifRevisionForClasse(tarifsClasses = [], classe = "") {
  return getTarifRevisionValue(getTarifConfigForClasse(tarifsClasses, classe));
}

export function getTarifAutreForClasse(tarifsClasses = [], classe = "") {
  return getTarifAutreValue(getTarifConfigForClasse(tarifsClasses, classe));
}

export function getTarifMensuelForClasse(tarifsClasses = [], classe = "") {
  return getTarifMensuelTotal(getTarifConfigForClasse(tarifsClasses, classe), classe);
}

export function getTarifInscriptionForClasse(tarifsClasses = [], classe = "") {
  const tarif = getTarifConfigForClasse(tarifsClasses, classe);
  return Number(tarif?.inscription || 0);
}

export function getTarifReinscriptionForClasse(tarifsClasses = [], classe = "") {
  const tarif = getTarifConfigForClasse(tarifsClasses, classe);
  return Number(tarif?.reinscription || 0);
}

export function getTarifInscriptionForEleve(eleve = {}, tarifsClasses = []) {
  return eleve.typeInscription === "Réinscription"
    ? getTarifReinscriptionForClasse(tarifsClasses, eleve.classe)
    : getTarifInscriptionForClasse(tarifsClasses, eleve.classe);
}

export function countPaidMonths(eleve = {}, moisAnnee = []) {
  return moisAnnee.filter((mois) => (eleve.mens || {})[mois] === "Payé").length;
}

export function countUnpaidMonths(eleve = {}, moisAnnee = []) {
  return moisAnnee.length - countPaidMonths(eleve, moisAnnee);
}

export function getConsecutiveUnpaidMonths(eleve = {}, moisAnnee = []) {
  const mens = eleve.mens || {};
  const firstPaidFromEnd = moisAnnee.slice().reverse().findIndex((mois) => mens[mois] === "Payé");
  return firstPaidFromEnd === -1 ? moisAnnee.length : firstPaidFromEnd;
}

export function isEleveCritique(eleve = {}, moisAnnee = [], minimumUnpaid = 3) {
  return getConsecutiveUnpaidMonths(eleve, moisAnnee) >= minimumUnpaid;
}

export function getElevesCritiques(eleves = [], moisAnnee = [], minimumUnpaid = 3) {
  return eleves.filter((eleve) => isEleveCritique(eleve, moisAnnee, minimumUnpaid));
}

export function getEleveMensualiteSnapshot(eleve = {}, moisAnnee = [], tarifsClasses = []) {
  const nbPayes = countPaidMonths(eleve, moisAnnee);
  const nbImpayes = moisAnnee.length - nbPayes;
  const mensualite = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  const inscriptionTarif = getTarifInscriptionForEleve(eleve, tarifsClasses);
  const autreTarif = getTarifAutreForClasse(tarifsClasses, eleve.classe);
  const inscriptionPercu = eleve.inscriptionPayee ? inscriptionTarif : 0;
  const autrePercu = eleve.autrePayee ? autreTarif : 0;

  return {
    algoVersion: MENSUALITE_ALGO_VERSION,
    nbPayes,
    nbImpayes,
    montantMensualitesPercu: nbPayes * mensualite,
    montantInscriptionPercu: inscriptionPercu,
    montantAutrePercu: autrePercu,
    soldeMensualites: nbImpayes * mensualite,
    soldeInscription: eleve.inscriptionPayee ? 0 : inscriptionTarif,
    soldeAutre: eleve.autrePayee ? 0 : autreTarif,
  };
}

export function getEleveSolde(eleve = {}, moisAnnee = [], tarifsClasses = []) {
  const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses);
  return snapshot.soldeMensualites + snapshot.soldeInscription + snapshot.soldeAutre;
}

export function getMensualiteOverview(eleves = [], moisAnnee = [], tarifsClasses = []) {
  return eleves.reduce((summary, eleve) => {
    const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses);
    const totalDuEleve = moisAnnee.length * getTarifMensuelForClasse(tarifsClasses, eleve.classe);

    return {
      totalDu: summary.totalDu + totalDuEleve,
      totalPercu: summary.totalPercu + snapshot.montantMensualitesPercu,
      totalPayes: summary.totalPayes + snapshot.nbPayes,
      totalImpayes: summary.totalImpayes + snapshot.nbImpayes,
      totalInscriptionsPercues: summary.totalInscriptionsPercues + snapshot.montantInscriptionPercu,
      totalAutresPercus: summary.totalAutresPercus + snapshot.montantAutrePercu,
    };
  }, {
    totalDu: 0,
    totalPercu: 0,
    totalPayes: 0,
    totalImpayes: 0,
    totalInscriptionsPercues: 0,
    totalAutresPercus: 0,
  });
}

