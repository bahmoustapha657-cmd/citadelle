import {
  getDefaultMensualiteForClasse,
  getTarifAutreValue,
  getTarifMensuelTotal,
  getTarifRevisionValue,
} from "./constants.js";

// Bumper à chaque changement de formule (mensualité, solde, snapshot) qui
// rendrait les calculs antérieurs non reproductibles.
export const MENSUALITE_ALGO_VERSION = 1;

export type TarifClasse = {
  classe?: string;
  montant?: number | string;
  inscription?: number | string;
  reinscription?: number | string;
  revision?: number | string;
  autre?: number | string;
};

export type MensualiteEleve = {
  classe?: string;
  typeInscription?: string;
  inscriptionPayee?: boolean;
  autrePayee?: boolean;
  mens?: Record<string, string>;
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

export function getEleveMensualiteSnapshot(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = []): MensualiteSnapshot {
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

export function getEleveSolde(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = []): number {
  const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses);
  return snapshot.soldeMensualites + snapshot.soldeInscription + snapshot.soldeAutre;
}

export function getMensualiteOverview(eleves: MensualiteEleve[] = [], moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = []): MensualiteOverview {
  return eleves.reduce<MensualiteOverview>((summary, eleve) => {
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
