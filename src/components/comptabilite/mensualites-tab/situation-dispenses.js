// Situation des dispenses de paiement, imprimée depuis la fenêtre
// « 🎓 Dispenses » : les élèves dispensés de l'année, classe par classe —
// taux de chaque poste, motif, qui l'a accordée, manque à gagner —, puis les
// statistiques : part de l'effectif dispensée, par poste (dispense totale ou
// partielle, taux moyen, montant), par motif, par classe, par section, et
// les demandes de la comptabilité encore en attente ou refusées.
//
// Manque à gagner : celui de la fenêtre et du bilan (getEleveMensualiteSnapshot)
// — ce que l'école renonce à percevoir sur ce qui restait dû ; ce qui a déjà
// été encaissé n'est pas compté.
//
// Ce que paie un dispensé, poste par poste (mêmes chiffres que la grille) :
//  • aPayer : la part laissée à la famille après la dispense, déjà encaissé
//    compris (payé + reste) ;
//  • paye : l'encaissé (mois au tarif figé, acomptes, inscription, frais) ;
//  • reste : ce qui reste dû sur l'année ;
//  • retard : mois ÉCHUS impayés, la règle de l'alerte mensualités et de la
//    situation des paiements (échéance de l'école, mois de garantie).
//
// Effectif : les élèves de l'année, comme la grille des mensualités (partis
// avant la rentrée sans rien payer et non réinscrits retirés exclus) — un
// élève dispensé, lui, est toujours compté.
// Mise en page : reports/situation-dispenses.js. Aucune dépendance React.
import { getDemande, STATUT_REFUSEE } from "../../../demande-dispense.js";
import { sansNonReinscritsEcartes } from "../../../ecartes-non-reinscrits.js";
import {
  MOTIFS_EXONERATION, POSTES_EXONERABLES, aUneExoneration, clampPourcentage, getExoneration,
} from "../../../exoneration-utils.js";
import { concerneParAnnee, getEleveMensualiteSnapshot } from "../../../mensualite-utils.js";
import { moisGarantieEcole } from "../../../paiements-scolarite.js";
import { reglagesAlerte, retardEleve } from "./alerte-mensualites.js";
import { grouperParClasse } from "./liste-mois.js";

// État des paiements d'un dispensé, du plus favorable au moins favorable :
//  • rien : rien à payer (dispensé de tout, rien encaissé) ;
//  • solde : tout payé ;
//  • ajour : il reste à payer, mais aucun mois échu impayé ;
//  • retard : au moins un mois échu impayé.
export const ETATS_PAIEMENT = ["rien", "solde", "ajour", "retard"];

export function etatPaiement({ aPayer = 0, reste = 0, moisRetard = 0 } = {}) {
  if (moisRetard > 0) return "retard";
  if (aPayer <= 0) return "rien";
  return reste > 0 ? "ajour" : "solde";
}

const montantsVides = () => ({ aPayer: 0, paye: 0, reste: 0 });
const montantsPoste = (paye, reste) => ({ aPayer: paye + reste, paye, reste });

// « eleves » : la liste des élèves dispensés puis les statistiques ;
// « stats » : les statistiques seules.
export const DETAILS_DISPENSES = ["eleves", "stats"];

// Élèves de l'année dans `eleves` (une section).
export function elevesDeLAnnee(eleves = [], { moisAnnee = [], annee, schoolInfo = {}, aujourdhui = new Date() } = {}) {
  const gardes = new Set(sansNonReinscritsEcartes(eleves, schoolInfo, annee, aujourdhui));
  return eleves.filter((e) => concerneParAnnee(e, moisAnnee, annee) && (gardes.has(e) || aUneExoneration(e)));
}

/**
 * Ligne d'un élève dispensé, ou null s'il ne l'est pas :
 *  • taux : pourcentage de chaque poste (0 = poste non dispensé) ;
 *  • motif, precision, accordeePar, accordeeLe : ceux de la dispense ;
 *  • montants : manque à gagner de chaque poste ; total : leur somme ;
 *  • moisDispenses : mois de mensualité restant dus couverts par une
 *    dispense totale des mensualités ;
 *  • paiement : { aPayer, paye, reste } de chaque poste ; aPayer, paye,
 *    reste : leurs sommes ; moisPayes : mois de mensualité soldés ;
 *  • moisRetard / montantRetard : mois échus impayés et ce qu'ils doivent ;
 *  • etat : etatPaiement (rien, solde, ajour, retard).
 */
export function ligneDispense(eleve = {}, {
  moisAnnee = [], annee, tarifsClasses = [], schoolInfo = {}, aujourdhui = new Date(),
} = {}) {
  const exo = getExoneration(eleve);
  if (!exo) return null;
  const s = getEleveMensualiteSnapshot(eleve, moisAnnee, tarifsClasses, annee);
  const paiement = {
    mensualites: montantsPoste(s.montantMensualitesPercu, s.soldeMensualites),
    inscription: montantsPoste(s.montantInscriptionPercu, s.soldeInscription),
    fraisAnnexes: montantsPoste(s.montantAutrePercu, s.soldeAutre),
  };
  const somme = (champ) => POSTES_EXONERABLES.reduce((n, poste) => n + paiement[poste][champ], 0);
  const retard = retardEleve(eleve, {
    moisAnnee, annee, tarifsClasses, aujourdhui,
    jourEcheance: reglagesAlerte(schoolInfo).jourEcheance, moisGarantie: moisGarantieEcole(schoolInfo),
  });
  const ligne = {
    eleve,
    taux: Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, clampPourcentage(exo[poste])])),
    motif: exo.motif || "autre",
    precision: exo.precision || "",
    accordeePar: exo.accordeePar || "",
    accordeeLe: exo.accordeeLe || "",
    montants: { ...s.exonereParPoste },
    total: s.montantExonere,
    moisDispenses: s.nbExoneres,
    paiement,
    aPayer: somme("aPayer"),
    paye: somme("paye"),
    reste: somme("reste"),
    moisPayes: s.nbPayes,
    moisRetard: retard.mois.length,
    montantRetard: retard.montant,
  };
  return { ...ligne, etat: etatPaiement(ligne) };
}

const posteVide = () => ({ eleves: 0, totale: 0, partielle: 0, sommeTaux: 0, tauxMoyen: 0, montant: 0 });

/**
 * Statistiques d'un groupe (une classe, une section, toute la sélection) :
 *  • effectif (élèves de l'année), dispenses (élèves dispensés) ;
 *  • parPoste : pour chaque poste, élèves dispensés dessus, dont à 100 %
 *    (totale) et à moins (partielle), taux moyen (arrondi), manque à gagner ;
 *  • parMotif : élèves et manque à gagner par motif — motifs présents
 *    seulement, le plus fréquent d'abord ;
 *  • montant : manque à gagner total ; moisDispenses : mois dispensés ;
 *  • paiement : { aPayer, paye, reste } de chaque poste, tous dispensés
 *    réunis ; aPayer, paye, reste : leurs sommes ;
 *  • etats : nombre de dispensés par état (rien, solde, ajour, retard) ;
 *    rienPaye : ceux qui ont quelque chose à payer et n'ont encore rien
 *    payé ; montantRetard : ce que doivent les mois échus impayés.
 */
export function statsDispenses(lignes = [], effectif = lignes.length) {
  const parPoste = Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, posteVide()]));
  const paiement = Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, montantsVides()]));
  const etats = Object.fromEntries(ETATS_PAIEMENT.map((etat) => [etat, 0]));
  const motifs = new Map();
  let montant = 0;
  let moisDispenses = 0;
  let rienPaye = 0;
  let montantRetard = 0;
  for (const l of lignes) {
    for (const poste of POSTES_EXONERABLES) {
      for (const champ of ["aPayer", "paye", "reste"]) paiement[poste][champ] += l.paiement?.[poste]?.[champ] || 0;
    }
    if (l.etat) etats[l.etat] += 1;
    if (l.aPayer > 0 && !l.paye) rienPaye += 1;
    montantRetard += l.montantRetard || 0;
    for (const poste of POSTES_EXONERABLES) {
      const taux = l.taux[poste] || 0;
      if (!taux) continue;
      const p = parPoste[poste];
      p.eleves += 1;
      if (taux >= 100) p.totale += 1; else p.partielle += 1;
      p.sommeTaux += taux;
      p.montant += l.montants[poste] || 0;
    }
    const m = motifs.get(l.motif) || { motif: l.motif, eleves: 0, montant: 0 };
    m.eleves += 1;
    m.montant += l.total;
    motifs.set(l.motif, m);
    montant += l.total;
    moisDispenses += l.moisDispenses || 0;
  }
  for (const p of Object.values(parPoste)) p.tauxMoyen = p.eleves ? Math.round(p.sommeTaux / p.eleves) : 0;
  const ordre = (motif) => {
    const i = MOTIFS_EXONERATION.findIndex((m) => m.id === motif);
    return i < 0 ? MOTIFS_EXONERATION.length : i;
  };
  const parMotif = [...motifs.values()]
    .sort((a, b) => b.eleves - a.eleves || b.montant - a.montant || ordre(a.motif) - ordre(b.motif));
  const somme = (champ) => POSTES_EXONERABLES.reduce((n, poste) => n + paiement[poste][champ], 0);
  return {
    effectif, dispenses: lignes.length, parPoste, parMotif, montant, moisDispenses,
    paiement, aPayer: somme("aPayer"), paye: somme("paye"), reste: somme("reste"), etats, rienPaye, montantRetard,
  };
}

/**
 * Situation des dispenses des `sections` choisies.
 *  • lignes : les élèves dispensés ;
 *  • classes : TOUTES les classes de l'année (ordre des niveaux), dispensés
 *    ou non, avec leurs statistiques et `lignes` = leurs élèves dispensés ;
 *  • groupes : les classes qui ont au moins un élève dispensé ;
 *  • sections : statistiques de chaque section ;
 *  • total : statistiques de la sélection entière ;
 *  • demandes : demandes de l'année en attente puis refusées
 *    ({ eleve, section, demande }), sur toutes les fiches des sections.
 * @param {Record<string, Record<string, any>[]>} elevesParSection
 * @param {string[]} sections
 */
export function situationDispenses(elevesParSection = {}, sections = [], options = {}) {
  const parSection = sections.map((section) => {
    const population = elevesDeLAnnee(elevesParSection[section] || [], options);
    const lignes = population.map((e) => ligneDispense(e, options)).filter(Boolean);
    return { section, population, lignes };
  });
  const population = parSection.flatMap((s) => s.population);
  const lignes = parSection.flatMap((s) => s.lignes);
  const parEleve = new Map(lignes.map((l) => [l.eleve, l]));
  const dispensesDe = (items) => items.map(({ eleve }) => parEleve.get(eleve)).filter(Boolean);
  const classes = grouperParClasse(population.map((eleve) => ({ eleve })), (items) => statsDispenses(dispensesDe(items), items.length))
    .map((g) => ({ ...g, lignes: dispensesDe(g.lignes) }));
  const demandes = sections.flatMap((section) => (elevesParSection[section] || [])
    .map((eleve) => ({ eleve, section, demande: getDemande(eleve, options.annee) }))
    .filter((d) => d.demande));
  const refusee = (d) => (d.demande.statut === STATUT_REFUSEE ? 1 : 0);
  return {
    lignes,
    classes,
    groupes: classes.filter((g) => g.dispenses > 0),
    sections: parSection.map((s) => ({ section: s.section, ...statsDispenses(s.lignes, s.population.length) })),
    total: statsDispenses(lignes, population.length),
    demandes: demandes.sort((a, b) => refusee(a) - refusee(b)),
  };
}
