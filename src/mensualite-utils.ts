import {
  CATALOGUE_FRAIS_ANNEXES,
  getDefaultMensualiteForClasse,
  getFraisAnnexeDate,
  getFraisAnnexeMontantFige,
  getTarifAutreValue,
  getTarifFraisAnnexes,
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
import { moisExigibles, partiAvantAnnee } from "./depart-utils.js";

// Bumper à chaque changement de formule (mensualité, solde, snapshot) qui
// rendrait les calculs antérieurs non reproductibles.
// v2 : montants perçus figés au paiement (mensMontants[mois]) — un mois payé
// garde le tarif en vigueur au moment de l'encaissement ; seuls les mois
// impayés suivent le tarif courant. Fallback tarif courant pour les
// paiements antérieurs à la v2 (sans montant figé).
// v3 : élève parti (cf. depart-utils) — seuls les mois entamés avant son
// départ restent dus, et rien (inscription, frais) d'une année dont il n'a vu
// aucun mois. Ce qui a été encaissé reste compté comme perçu.
// v4 : la révision devient un frais ANNUEL (elle était ajoutée à chaque
// mensualité) ; l'inscription et les frais annexes figent eux aussi leur
// montant au paiement (inscriptionMontant, fraisMontants[id]).
// v5 : paiements en plusieurs fois — un mois, un frais ou l'inscription peut
// porter un ACOMPTE (mensAcomptes, fraisAcomptes, inscriptionAcompte), compté
// au perçu et déduit du reste dû. Le dû d'un mois ou d'un frais s'entend
// après dispense (montantDuMois, duNet) : c'est ce qui s'encaisse.
//
// `annee`, en dernier paramètre des fonctions ci-dessous : l'année scolaire de
// `moisAnnee`, qui situe ces mois par rapport à la date de départ. Omise, c'est
// celle de l'écran — juste partout, sauf quand on calcule sur la fiche
// courante pendant qu'on consulte une année archivée : là, il faut la passer.
export const MENSUALITE_ALGO_VERSION = 5;

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
  // Montant de l'inscription figé au paiement (v3).
  inscriptionMontant?: number | string | null;
  // Anciens drapeaux d'« Autre frais », encore lus (cf. isFraisAnnexePaye).
  autrePayee?: boolean;
  autreDate?: string | null;
  mens?: Record<string, string>;
  // Tarif mensuel figé au moment du paiement, par mois (cf. toggleMens).
  mensMontants?: Record<string, number | string>;
  // Frais annexes payés : { uniforme: "16/07/2026", … }.
  fraisPayes?: Record<string, string>;
  // Montant de chaque frais annexe, figé au paiement (v3).
  fraisMontants?: Record<string, number | string>;
  // Acomptes (v4) : déjà versé sur ce qui n'est pas encore soldé.
  mensAcomptes?: Record<string, number | string>;
  fraisAcomptes?: Record<string, number | string>;
  inscriptionAcompte?: number | string | null;
};

// Un frais annexe tel que l'élève le voit : facturé par sa classe, déjà payé,
// ou les deux.
export type LigneFraisAnnexe = {
  id: string;
  label: string;
  // Tarif actuel de la classe (0 s'il n'est plus facturé).
  du: number;
  // Ce que l'élève doit pour ce frais, dispense déduite.
  duNet: number;
  paye: boolean;
  date: string;
  // Payé : montant figé au paiement (repli sur le tarif actuel) ; sinon le dû
  // net de dispense.
  montant: number;
  // Déjà versé : le montant payé, ou l'acompte d'un frais pas encore soldé.
  verse: number;
  // Ce qu'il reste à verser (0 une fois payé).
  reste: number;
};

export type MensualiteSnapshot = {
  algoVersion: number;
  nbPayes: number;
  nbImpayes: number;
  // Mois commencés : un acompte versé, pas encore soldés (comptés impayés).
  nbPartiels: number;
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
  // Mois entamés par un acompte (inclus dans totalImpayes).
  totalPartiels: number;
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
// relances ou le blocage des bulletins. Même chose pour les mois qui suivent
// le départ d'un élève parti.
export function countUnpaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], annee?: string): number {
  if (estExonereTotal(eleve, "mensualites")) return 0;
  const mens = eleve.mens || {};
  return moisExigibles(eleve, moisAnnee, annee).filter((mois) => mens[mois] !== "Payé").length;
}

// Les bulletins de cet élève sont-ils retenus pour impayé ? La règle vivait en
// trois exemplaires (grille des bulletins, impression groupée, portail parent),
// chacun recomptant les mois non cochés à la main — un élève dispensé s'y
// retrouvait bloqué pour une dette qu'il n'a pas.
export function estBloquePourImpaye(
  schoolInfo: { blocageParentImpaye?: boolean } = {},
  eleve: MensualiteEleve = {},
  moisAnnee: string[] = [],
  annee?: string,
): boolean {
  if (!schoolInfo?.blocageParentImpaye) return false;
  return countUnpaidMonths(eleve, moisAnnee, annee) > 0;
}

export function getConsecutiveUnpaidMonths(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], annee?: string): number {
  if (estExonereTotal(eleve, "mensualites")) return 0;
  const mens = eleve.mens || {};
  const dus = moisExigibles(eleve, moisAnnee, annee);
  const firstPaidFromEnd = dus.slice().reverse().findIndex((mois) => mens[mois] === "Payé");
  return firstPaidFromEnd === -1 ? dus.length : firstPaidFromEnd;
}

export function isEleveCritique(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], minimumUnpaid: number = 3, annee?: string): boolean {
  return getConsecutiveUnpaidMonths(eleve, moisAnnee, annee) >= minimumUnpaid;
}

export function getElevesCritiques<T extends MensualiteEleve>(eleves: T[] = [], moisAnnee: string[] = [], minimumUnpaid: number = 3, annee?: string): T[] {
  return eleves.filter((eleve) => isEleveCritique(eleve, moisAnnee, minimumUnpaid, annee));
}

// L'élève a-t-il sa place dans la scolarité de l'année `annee` ? Oui s'il est
// présent, s'il l'a fréquentée avant de partir, ou s'il a déjà réglé quelque
// chose sur sa fiche — un encaissement doit rester visible, donc annulable.
// Non pour l'élève parti avant la rentrée sans rien avoir payé : il n'a rien
// à faire dans la grille des mensualités de cette année-là.
export function concerneParAnnee(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], annee?: string): boolean {
  if (!partiAvantAnnee(eleve, moisAnnee, annee)) return true;
  // Un acompte est de l'argent reçu : il doit rester visible, donc annulable.
  const acomptes = (carte?: Record<string, number | string>) => Object.values(carte || {}).some((v) => Number(v) > 0);
  return countPaidMonths(eleve, moisAnnee) > 0 || !!eleve.inscriptionPayee || !!eleve.autrePayee
    || Object.keys(eleve.fraisPayes || {}).length > 0
    || acomptes(eleve.mensAcomptes) || acomptes(eleve.fraisAcomptes) || Number(eleve.inscriptionAcompte) > 0;
}

// Montant perçu pour un mois payé : tarif figé au paiement si présent
// (mensMontants), sinon tarif courant (paiements antérieurs à la v2).
// Exporté pour que le reçu imprimé (reports/recus.js) affiche les mêmes
// montants que la grille des mensualités.
export function montantMoisPaye(eleve: MensualiteEleve, mois: string, mensualiteCourante: number): number {
  const fige = Number((eleve.mensMontants || {})[mois]);
  return Number.isFinite(fige) && fige > 0 ? fige : mensualiteCourante;
}

const positif = (valeur: unknown): number => {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Acomptes (v4) : ce qui a déjà été versé sur un mois, un frais ou
// l'inscription pas encore soldé.
export const acompteMois = (eleve: MensualiteEleve = {}, mois: string): number =>
  positif((eleve.mensAcomptes || {})[mois]);
export const acompteFrais = (eleve: MensualiteEleve = {}, id: string): number =>
  positif((eleve.fraisAcomptes || {})[id]);
export const acompteInscription = (eleve: MensualiteEleve = {}): number =>
  positif(eleve.inscriptionAcompte);

// Ce que l'élève doit pour un mois, dispense déduite : 0 s'il en est dispensé
// en totalité, la part restante s'il n'a qu'une réduction.
export function montantDuMois(eleve: MensualiteEleve = {}, mensualite: number = 0): number {
  if (estExonereTotal(eleve, "mensualites")) return 0;
  return montantApresExoneration(mensualite, eleve, "mensualites");
}

// Ce que l'élève doit pour l'inscription, dispense déduite.
export const montantDuInscription = (eleve: MensualiteEleve = {}, inscription: number = 0): number =>
  montantApresExoneration(inscription, eleve, "inscription");

// Inscription encaissée : montant figé au paiement — 0 compris, pour un élève
// dispensé validé sans encaissement — sinon (encaissée avant la v4) le tarif
// courant.
export function montantInscriptionPaye(eleve: MensualiteEleve, inscriptionCourante: number): number {
  const brut = eleve.inscriptionMontant;
  const fige = Number(brut);
  return brut !== null && brut !== undefined && brut !== "" && Number.isFinite(fige) && fige >= 0
    ? fige
    : inscriptionCourante;
}

// Frais annexes d'un élève, un par ligne, dans l'ordre du catalogue : ceux que
// sa classe facture ET ceux qu'il a déjà payés, même si le tarif ne les
// facture plus (frais remis à 0, changement de classe). Un encaissement ne
// doit pas disparaître des comptes parce que le tarif a changé depuis.
export function getFraisAnnexesEleve(eleve: MensualiteEleve = {}, tarif: TarifClasse | null = null): LigneFraisAnnexe[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factures: Record<string, number> = getTarifFraisAnnexes((tarif || {}) as any);
  return CATALOGUE_FRAIS_ANNEXES
    .filter((f) => factures[f.id] > 0 || isFraisAnnexePaye(eleve, f.id))
    .map((f) => {
      const du = Number(factures[f.id] || 0);
      const duNet = montantApresExoneration(du, eleve, "fraisAnnexes");
      const paye = isFraisAnnexePaye(eleve, f.id);
      const montant = paye ? (getFraisAnnexeMontantFige(eleve, f.id) ?? du) : duNet;
      const acompte = paye ? 0 : acompteFrais(eleve, f.id);
      return {
        id: f.id,
        label: f.label,
        du,
        duNet,
        paye,
        date: paye ? getFraisAnnexeDate(eleve, f.id) : "",
        montant,
        verse: paye ? montant : acompte,
        reste: paye ? 0 : Math.max(0, duNet - acompte),
      };
    });
}

export function getEleveMensualiteSnapshot(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = [], annee?: string): MensualiteSnapshot {
  const mens = eleve.mens || {};
  // Ce qui a été encaissé (mois payés, acomptes) reste perçu, départ ou pas ;
  // seul le reste à devoir se limite à ce que l'élève a réellement fréquenté.
  const exigibles = new Set(moisExigibles(eleve, moisAnnee, annee));
  // Parti avant le premier mois de l'année : ni inscription ni frais annexes
  // à lui réclamer pour une année qu'il n'a pas faite.
  const aFrequente = !partiAvantAnnee(eleve, moisAnnee, annee);
  const mensualite = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  const duMois = montantDuMois(eleve, mensualite);
  // Dispense : on ne touche JAMAIS à ce qui a déjà été encaissé (montants
  // figés, acomptes) — seul le reste à devoir est allégé, chaque poste à son
  // taux. Le « manque à gagner » est la part dispensée de ce qui reste dû.
  let nbPayes = 0;
  let nbImpayes = 0;
  let nbPartiels = 0;
  let nbNonPayes = 0;
  let montantMensualitesPercu = 0;
  let soldeMensualites = 0;
  let exonere = 0;
  for (const mois of moisAnnee) {
    if (mens[mois] === "Payé") {
      nbPayes += 1;
      montantMensualitesPercu += montantMoisPaye(eleve, mois, mensualite);
      continue;
    }
    const acompte = acompteMois(eleve, mois);
    montantMensualitesPercu += acompte;
    // Mois postérieur au départ : rien de dû.
    if (!exigibles.has(mois)) continue;
    const reste = Math.max(0, duMois - acompte);
    nbNonPayes += 1;
    soldeMensualites += reste;
    exonere += mensualite - duMois;
    if (reste > 0) {
      nbImpayes += 1;
      if (acompte > 0) nbPartiels += 1;
    }
  }
  const nbExoneres = estExonereTotal(eleve, "mensualites") ? nbNonPayes : 0;

  const inscriptionTarif = getTarifInscriptionForEleve(eleve, tarifsClasses);
  let montantInscriptionPercu = 0;
  let soldeInscription = 0;
  if (eleve.inscriptionPayee) {
    montantInscriptionPercu = montantInscriptionPaye(eleve, inscriptionTarif);
  } else {
    const acompte = acompteInscription(eleve);
    montantInscriptionPercu = acompte;
    if (aFrequente) {
      const duInscription = montantDuInscription(eleve, inscriptionTarif);
      soldeInscription = Math.max(0, duInscription - acompte);
      exonere += inscriptionTarif - duInscription;
    }
  }

  // Frais annexes (autre, révision, catalogue) : perçu au montant figé s'il
  // est payé (ou l'acompte versé), sinon reste dû net de dispense — pour une
  // année fréquentée.
  let montantAutrePercu = 0;
  let soldeAutre = 0;
  for (const ligne of getFraisAnnexesEleve(eleve, getTarifConfigForClasse(tarifsClasses, eleve.classe))) {
    montantAutrePercu += ligne.verse;
    if (ligne.paye || !aFrequente) continue;
    soldeAutre += ligne.reste;
    exonere += ligne.du - ligne.duNet;
  }

  return {
    algoVersion: MENSUALITE_ALGO_VERSION,
    nbPayes,
    nbImpayes,
    nbPartiels,
    nbExoneres,
    montantExonere: exonere,
    montantMensualitesPercu,
    montantInscriptionPercu,
    montantAutrePercu,
    soldeMensualites,
    soldeInscription,
    soldeAutre,
  };
}

export function getEleveSolde(eleve: MensualiteEleve = {}, moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = [], annee?: string): number {
  const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses, annee);
  return snapshot.soldeMensualites + snapshot.soldeInscription + snapshot.soldeAutre;
}

export function getMensualiteOverview(eleves: MensualiteEleve[] = [], moisAnnee: string[] = [], tarifsClasses: TarifClasse[] = [], annee?: string): MensualiteOverview {
  return eleves.reduce<MensualiteOverview>((summary, eleve) => {
    const snapshot = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses, annee);
    // Dû = perçu réel (montants figés) + reste à percevoir au tarif courant.
    const totalDuEleve = snapshot.montantMensualitesPercu + snapshot.soldeMensualites;

    return {
      totalDu: summary.totalDu + totalDuEleve,
      totalPercu: summary.totalPercu + snapshot.montantMensualitesPercu,
      totalPayes: summary.totalPayes + snapshot.nbPayes,
      totalImpayes: summary.totalImpayes + snapshot.nbImpayes,
      totalPartiels: summary.totalPartiels + snapshot.nbPartiels,
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
    totalPartiels: 0,
    totalInscriptionsPercues: 0,
    totalAutresPercus: 0,
    totalElevesExoneres: 0,
    totalExonere: 0,
  });
}
