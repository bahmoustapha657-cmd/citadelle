import {
  getDefaultMensualiteForClasse,
  getTarifAutreValue,
  getTarifFraisDivers,
  getTarifMensuelTotal,
  getTarifRevisionValue,
  isFraisAnnexePaye,
} from "./constants.js";

// Bumper à chaque changement de formule (mensualité, solde, snapshot) qui
// rendrait les calculs antérieurs non reproductibles.
// v2 : montants perçus figés au paiement (mensMontants[mois]) — un mois payé
// garde le tarif en vigueur au moment de l'encaissement ; seuls les mois
// impayés suivent le tarif courant. Fallback tarif courant pour les
// paiements antérieurs à la v2 (sans montant figé).
export const MENSUALITE_ALGO_VERSION = 2;

export type TarifClasse = {
  classe?: string;
  montant?: number | string;
  inscription?: number | string;
  reinscription?: number | string;
  revision?: number | string;
  autre?: number | string;
  // Catalogue de frais annexes configurables : { uniforme: 50000, … }.
  fraisDivers?: Record<string, number | string>;
};

export type MensualiteEleve = {
  classe?: string;
  typeInscription?: string;
  inscriptionPayee?: boolean;
  autrePayee?: boolean;
  mens?: Record<string, string>;
  // Tarif mensuel figé au moment du paiement, par mois (cf. toggleMens).
  mensMontants?: Record<string, number | string>;
  // Frais annexes du catalogue payés : { uniforme: "16/07/2026", … }.
  fraisPayes?: Record<string, string>;
};

export type MensualiteSnapshot = {
  algoVersion: number;
  nbPayes: number;
  nbImpayes: number;
  montantMensualitesPercu: number;
  montantInscriptionPercu: number;
  montantAutrePercu: number;
  soldeMensualites: number;
  soldeInscription: number;
  soldeAutre: number;
};

export type MensualiteOverview = {
  totalDu: number;
  totalPercu: number;
  totalPayes: number;
  totalImpayes: number;
  totalInscriptionsPercues: number;
  totalAutresPercus: number;
};

export function getTarifConfigForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): TarifClasse | null {
  return tarifsClasses.find((tarif) => tarif.classe === classe) || null;
}

export function getTarifBaseForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): number {
  const tarif = getTarifConfigForClasse(tarifsClasses, classe);
  if (tarif) return Number(tarif.montant || 0);
  return getDefaultMensualiteForClasse(classe);
}

export function getTarifRevisionForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getTarifRevisionValue(getTarifConfigForClasse(tarifsClasses, classe) as any);
}

export function getTarifAutreForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getTarifAutreValue(getTarifConfigForClasse(tarifsClasses, classe) as any);
}

export function getTarifMensuelForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getTarifMensuelTotal(getTarifConfigForClasse(tarifsClasses, classe) as any, classe);
}

export function getTarifInscriptionForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): number {
  const tarif = getTarifConfigForClasse(tarifsClasses, classe);
  return Number(tarif?.inscription || 0);
}

export function getTarifReinscriptionForClasse(tarifsClasses: TarifClasse[] = [], classe: string = ""): number {
  const tarif = getTarifConfigForClasse(tarifsClasses, classe);
  return Number(tarif?.reinscription || 0);
}

export function getTarifInscriptionForEleve(eleve: MensualiteEleve = {}, tarifsClasses: TarifClasse[] = []): number {
  return eleve.typeInscription === "Réinscription"
    ? getTarifReinscriptionForClasse(tarifsClasses, eleve.classe)
    : getTarifInscriptionForClasse(tarifsClasses, eleve.classe);
}

export function countPaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = []): number {
  return moisAnnee.filter((mois) => (eleve.mens || {})[mois] === "Payé").length;
}

export function countUnpaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = []): number {
  return moisAnnee.length - countPaidMonths(eleve, moisAnnee);
}

export function getConsecutiveUnpaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = []): number {
  const mens = eleve.mens || {};
  const firstPaidFromEnd = moisAnnee.slice().reverse().findIndex((mois) => mens[mois] === "Payé");
  return firstPaidFromEnd === -1 ? moisAnnee.length : firstPaidFromEnd;
}

export function isEleveCritique(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], minimumUnpaid: number = 3): boolean {
  return getConsecutiveUnpaidMonths(eleve, moisAnnee) >= minimumUnpaid;
}

export function getElevesCritiques<T extends MensualiteEleve>(eleves: T[] = [], moisAnnee: string[] = [], minimumUnpaid: number = 3): T[] {
  return eleves.filter((eleve) => isEleveCritique(eleve, moisAnnee, minimumUnpaid));
}

// Montant perçu pour un mois payé : tarif figé au paiement si présent
// (mensMontants), sinon tarif courant (paiements antérieurs à la v2).
// Exporté pour que le reçu imprimé (reports/recus.js) affiche les mêmes
// montants que la grille des mensualités.
export function montantMoisPaye(eleve: MensualiteEleve, mois: string, mensualiteCourante: number): number {
  const fige = Number((eleve.mensMontants || {})[mois]);
  return Number.isFinite(fige) && fige > 0 ? fige : mensualiteCourante;
}

export function getEleveMensualiteSnapshot(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = []): MensualiteSnapshot {
  const mens = eleve.mens || {};
  const moisPayes = moisAnnee.filter((mois) => mens[mois] === "Payé");
  const nbPayes = moisPayes.length;
  const nbImpayes = moisAnnee.length - nbPayes;
  const mensualite = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  const inscriptionTarif = getTarifInscriptionForEleve(eleve, tarifsClasses);
  const autreTarif = getTarifAutreForClasse(tarifsClasses, eleve.classe);
  const inscriptionPercu = eleve.inscriptionPayee ? inscriptionTarif : 0;
  const autrePercu = eleve.autrePayee ? autreTarif : 0;
  // Frais annexes du catalogue (hors « autre », compté ci-dessus) : perçu si
  // payé par l'élève, sinon reste dû.
  const fraisDivers = getTarifFraisDivers(getTarifConfigForClasse(tarifsClasses, eleve.classe) || {});
  let diversPercu = 0;
  let soldeDivers = 0;
  for (const [fraisId, montant] of Object.entries(fraisDivers)) {
    if (isFraisAnnexePaye(eleve, fraisId)) diversPercu += Number(montant);
    else soldeDivers += Number(montant);
  }

  return {
    algoVersion: MENSUALITE_ALGO_VERSION,
    nbPayes,
    nbImpayes,
    montantMensualitesPercu: moisPayes.reduce((somme, mois) => somme + montantMoisPaye(eleve, mois, mensualite), 0),
    montantInscriptionPercu: inscriptionPercu,
    montantAutrePercu: autrePercu + diversPercu,
    soldeMensualites: nbImpayes * mensualite,
    soldeInscription: eleve.inscriptionPayee ? 0 : inscriptionTarif,
    soldeAutre: (eleve.autrePayee ? 0 : autreTarif) + soldeDivers,
  };
}

export function getEleveSolde(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = []): number {
  const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses);
  return snapshot.soldeMensualites + snapshot.soldeInscription + snapshot.soldeAutre;
}

export function getMensualiteOverview(eleves: MensualiteEleve[] = [], moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = []): MensualiteOverview {
  return eleves.reduce<MensualiteOverview>((summary, eleve) => {
    const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses);
    // Dû = perçu réel (montants figés) + reste à percevoir au tarif courant.
    const totalDuEleve = snapshot.montantMensualitesPercu + snapshot.soldeMensualites;

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
