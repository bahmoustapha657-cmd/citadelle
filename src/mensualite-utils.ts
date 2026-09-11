import {
  getDefaultMensualiteForClasse,
  getTarifAutreValue,
  getTarifFraisDivers,
  getTarifMensuelTotal,
  getTarifRevisionValue,
  isFraisAnnexePaye,
} from "./constants.js";
import {
  type EleveExonerable,
  aUneExoneration,
  estExonereTotal,
  montantApresExoneration,
} from "./exoneration-utils.js";

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

export type MensualiteEleve = EleveExonerable & {
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
  // Mois couverts par une dispense totale : ni payés, ni dus.
  nbExoneres: number;
  // Ce que l'école renonce à percevoir sur cet élève cette année.
  montantExonere: number;
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
  // Dispenses accordées : combien d'élèves, et ce que l'école y renonce.
  totalElevesExoneres: number;
  totalExonere: number;
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

// Un élève dispensé de TOUTE la mensualité ne doit rien : ses mois non cochés
// ne sont pas des impayés, et il n'a donc rien à faire dans les alertes, les
// relances ou le blocage des bulletins.
export function countUnpaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = []): number {
  if (estExonereTotal(eleve, "mensualites")) return 0;
  return moisAnnee.length - countPaidMonths(eleve, moisAnnee);
}

// Les bulletins de cet élève sont-ils retenus pour impayé ? La règle vivait en
// trois exemplaires (grille des bulletins, impression groupée, portail parent),
// chacun recomptant les mois non cochés à la main — un élève dispensé s'y
// retrouvait bloqué pour une dette qu'il n'a pas.
export function estBloquePourImpaye(
  schoolInfo: { blocageParentImpaye?: boolean } = {},
  eleve: MensualiteEleve = {},
  moisAnnee: string[] = [],
): boolean {
  if (!schoolInfo?.blocageParentImpaye) return false;
  return countUnpaidMonths(eleve, moisAnnee) > 0;
}

export function getConsecutiveUnpaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = []): number {
  if (estExonereTotal(eleve, "mensualites")) return 0;
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
  let soldeDiversPlein = 0;
  for (const [fraisId, montant] of Object.entries(fraisDivers)) {
    if (isFraisAnnexePaye(eleve, fraisId)) diversPercu += Number(montant);
    else soldeDiversPlein += Number(montant);
  }

  // Dispense : on ne touche JAMAIS à ce qui a déjà été encaissé (montants figés
  // au paiement) — seul le reste à devoir est allégé, chaque poste à son taux.
  const exonereMois = estExonereTotal(eleve, "mensualites");
  const nbExoneres = exonereMois ? nbImpayes : 0;
  const nbRestants = exonereMois ? 0 : nbImpayes;
  const soldeMensualitesPlein = nbImpayes * mensualite;
  const soldeMensualites = nbRestants * montantApresExoneration(mensualite, eleve, "mensualites");
  const soldeInscriptionPlein = eleve.inscriptionPayee ? 0 : inscriptionTarif;
  const soldeInscription = montantApresExoneration(soldeInscriptionPlein, eleve, "inscription");
  const soldeAutrePlein = (eleve.autrePayee ? 0 : autreTarif) + soldeDiversPlein;
  const soldeAutre = montantApresExoneration(soldeAutrePlein, eleve, "fraisAnnexes");

  return {
    algoVersion: MENSUALITE_ALGO_VERSION,
    nbPayes,
    nbImpayes: nbRestants,
    nbExoneres,
    montantExonere: (soldeMensualitesPlein - soldeMensualites)
      + (soldeInscriptionPlein - soldeInscription)
      + (soldeAutrePlein - soldeAutre),
    montantMensualitesPercu: moisPayes.reduce((somme, mois) => somme + montantMoisPaye(eleve, mois, mensualite), 0),
    montantInscriptionPercu: inscriptionPercu,
    montantAutrePercu: autrePercu + diversPercu,
    soldeMensualites,
    soldeInscription,
    soldeAutre,
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
      totalElevesExoneres: summary.totalElevesExoneres + (aUneExoneration(eleve) ? 1 : 0),
      totalExonere: summary.totalExonere + snapshot.montantExonere,
    };
  }, {
    totalDu: 0,
    totalPercu: 0,
    totalPayes: 0,
    totalImpayes: 0,
    totalInscriptionsPercues: 0,
    totalAutresPercus: 0,
    totalElevesExoneres: 0,
    totalExonere: 0,
  });
}
