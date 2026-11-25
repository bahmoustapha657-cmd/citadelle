// Liste des élèves d'UN mois, imprimée depuis l'onglet Mensualités : ceux qui
// ont payé le mois choisi, ou ceux qui ne l'ont pas encore payé, rangés par
// classe, avec devant chaque nom ce qu'il a payé dans l'année. Même périmètre
// que la grille (section ou « Tout », classe), non réinscrits retirés exclus.
// Mise en page : reports/listes-mensualites.js (listeMoisHTML).
// Aucune dépendance React : testable en isolation.
import { TOUS_MOIS_LONGS, comparerClassesParNiveau } from "../../../constants.js";
import { moisExigibles } from "../../../depart-utils.js";
import { estExonereTotal } from "../../../exoneration-utils.js";
import {
  acompteMois, getEleveMensualiteSnapshot, getTarifMensuelForClasse, montantDuMois, montantMoisPaye,
} from "../../../mensualite-utils.js";

// « payes » : ont soldé le mois ; « impayes » : le devaient et ne l'ont pas soldé.
export const STATUTS_LISTE_MOIS = ["payes", "impayes"];

// Mois proposé d'office : le mois en cours s'il fait partie de l'année
// scolaire, sinon le premier mois de l'année.
export function moisParDefaut(moisAnnee = [], aujourdhui = new Date()) {
  // TOUS_MOIS_LONGS commence en septembre (getMonth() = 8).
  const courant = TOUS_MOIS_LONGS[(aujourdhui.getMonth() + 4) % 12];
  return moisAnnee.includes(courant) ? courant : (moisAnnee[0] || "");
}

// Ce que l'élève a payé dans l'année : mensualités (montants figés, acomptes
// compris), inscription et frais annexes — mêmes montants que la grille.
// Aussi utilisé par la situation générale (situation-generale.js).
export function payeDansAnnee(eleve, moisAnnee, tarifsClasses, annee) {
  const s = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses, annee);
  const mensualites = s.montantMensualitesPercu;
  const autres = s.montantInscriptionPercu + s.montantAutrePercu;
  return { mensualites, autres, total: mensualites + autres };
}

/**
 * Lignes de la liste du mois `mois`, dans l'ordre de `eleves`.
 *  • payes : `montantMois` = mensualité encaissée pour ce mois (tarif figé) ;
 *  • impayes : `montantMois` = reste dû sur ce mois (dispense et acompte
 *    déduits), `acompte` = déjà versé dessus. Un mois postérieur au départ, ou
 *    dont l'élève est entièrement dispensé, n'est pas dû : il n'y figure pas.
 * @returns {{ eleve: Record<string, any>, moisPayes: string[], montantMois: number, acompte: number,
 *   mensualites: number, autres: number, total: number }[]}
 */
export function lignesListeMois(eleves = [], {
  mois = "", statut = "payes", moisAnnee = [], annee, tarifsClasses = [],
} = {}) {
  if (!mois) return [];
  const lignes = [];
  for (const eleve of eleves) {
    const mens = eleve.mens || {};
    const tarif = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
    const paye = mens[mois] === "Payé";
    let montantMois = 0;
    let acompte = 0;
    if (statut === "impayes") {
      if (paye || estExonereTotal(eleve, "mensualites")) continue;
      if (!moisExigibles(eleve, moisAnnee, annee).includes(mois)) continue;
      const du = montantDuMois(eleve, tarif);
      acompte = acompteMois(eleve, mois);
      montantMois = Math.max(0, du - acompte);
      // Acompte qui couvre le dû : plus rien à réclamer. Tarif inconnu (0) :
      // l'élève reste signalé, sans montant (comme l'alerte).
      if (du > 0 && montantMois === 0) continue;
    } else {
      if (!paye) continue;
      montantMois = montantMoisPaye(eleve, mois, tarif);
    }
    lignes.push({
      eleve,
      moisPayes: moisAnnee.filter((m) => mens[m] === "Payé"),
      montantMois,
      acompte,
      ...payeDansAnnee(eleve, moisAnnee, tarifsClasses, annee),
    });
  }
  return lignes;
}

export const totauxListeMois = (lignes = []) => lignes.reduce((t, l) => ({
  montantMois: t.montantMois + l.montantMois,
  mensualites: t.mensualites + l.mensualites,
  autres: t.autres + l.autres,
  total: t.total + l.total,
}), { montantMois: 0, mensualites: 0, autres: 0, total: 0 });

// Lignes rangées par classe, classes dans l'ordre des niveaux (élèves sans
// classe à la fin) ; dans une classe, l'ordre reçu (alphabétique de l'école).
// `totaux` : sous-totaux de chaque classe (ceux de la liste d'un mois par défaut).
export function grouperParClasse(lignes = [], totaux = totauxListeMois) {
  const parClasse = new Map();
  for (const l of lignes) {
    const classe = String(l.eleve?.classe || "").trim();
    if (!parClasse.has(classe)) parClasse.set(classe, []);
    parClasse.get(classe).push(l);
  }
  return [...parClasse.entries()]
    .sort(([a], [b]) => Number(!a) - Number(!b) || comparerClassesParNiveau(a, b))
    .map(([classe, ls]) => ({ classe, lignes: ls, ...totaux(ls) }));
}
