// GÉNÉRÉ par scripts/partager-edge.mjs depuis src/depart-utils.js — ne pas modifier ici.
// ══════════════════════════════════════════════════════════════════════════
//  Élève parti — la règle commune
// ══════════════════════════════════════════════════════════════════════════
// Un départ (Transféré, Exclu, Abandonné, Décédé, Diplômé) ne supprime pas la
// fiche : elle garde sa classe, ses paiements, ses notes. Chaque écran en
// tirait ses propres conclusions — la plupart n'en tiraient aucune, et
// l'élève parti restait dans les effectifs et continuait de devoir ses
// mensualités, jusqu'à l'année suivante que la clôture lui remettait à payer.
//
// Ce module dit, pour toute l'application :
//  • ce qu'il doit encore : les mois ENTAMÉS avant son départ, et rien d'une
//    année dont il n'a vu aucun mois (moisExigibles, partiAvantAnnee) — ni
//    d'une année où il n'a RIEN payé : l'élève non réinscrit qu'on déclare
//    parti n'est pas revenu, il ne laisse aucun arriéré (choix de la
//    direction, 2026-10) ;
//  • après un retour, les mois passés hors de l'école quand la direction les
//    a déclarés non dus (interruptions, cf. champsRetour) ;
//  • où il compte : plus dans l'effectif (estSorti, dans constants.js), mais
//    toujours dans les résultats des périodes où il a été noté
//    (elevesPourPeriode) — son rang d'alors ne doit pas bouger ;
//  • ce que sa fiche doit porter (normaliserDepart).
//
// Extension explicite : ce module est couvert par des tests Node, dont la
// résolution ESM n'infère pas les extensions comme le fait Vite.
import {
  STATUTS_SORTIE, TOUS_MOIS_COURTS, TOUS_MOIS_LONGS, anneePrecedente, anneeScolaireDeDate, estSorti, getAnnee,
} from "./constants.js";

// Champs de la fiche qui décrivent le départ.
export const CHAMPS_DEPART = ["dateDepart", "motifDepart", "destinationDepart"];

/**
 * Élèves encore inscrits : ce qui a sa place dans une liste de classe, un
 * effectif, une saisie de notes ou d'absences.
 * @template T
 * @param {T[]} [eleves]
 * @returns {T[]}
 */
export const presents = (eleves = []) => eleves.filter((e) => !estSorti(e));

/**
 * « AAAA-MM-JJ » (champ date) ou « JJ/MM/AAAA » (import Excel, today()) →
 * Date locale à 0 h. null pour tout le reste, dates impossibles comprises.
 * @param {unknown} valeur
 * @returns {Date | null}
 */
export function lireDate(valeur) {
  const v = String(valeur ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const local = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!iso && !local) return null;
  const an = Number(iso ? iso[1] : local[3]);
  const mois = Number(iso ? iso[2] : local[2]);
  const jour = Number(iso ? iso[3] : local[1]);
  const date = new Date(an, mois - 1, jour);
  // 31/02 glisserait au 3 mars : une date qui ne se relit pas est illisible.
  return date.getFullYear() === an && date.getMonth() === mois - 1 && date.getDate() === jour ? date : null;
}

// Année de l'écran (celle que l'utilisateur regarde). Hors navigateur — tests
// Node, sans localStorage — elle est inconnue et rien n'est retiré.
function anneeEcran() {
  try { return getAnnee(); } catch { return ""; }
}

// Premier jour du mois `mois` (« Oct » ou « Octobre »…) de l'année scolaire
// `annee`. Même convention que finAnneeScolaire et anneeScolaireDeDate :
// septembre ouvre l'année, un mois de septembre à décembre tombe en AAAA, de
// janvier à août en AAAA+1. null si l'année ou le mois ne se lisent pas.
function debutDuMois(annee, mois) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(annee || "").trim());
  const court = TOUS_MOIS_COURTS.indexOf(mois);
  const rang = court >= 0 ? court : TOUS_MOIS_LONGS.indexOf(mois);
  if (!m || rang < 0) return null;
  return new Date(Number(m[1]), 8 + rang, 1);
}

/**
 * L'élève a-t-il quoi que ce soit d'encaissé sur son année courante (mois,
 * inscription, frais, acompte) ? Un acompte est de l'argent reçu : il compte.
 * @param {Record<string, any>} [eleve]
 * @returns {boolean}
 */
export function aDesPaiements(eleve = {}) {
  const mens = eleve.mens || {};
  if (Object.values(mens).some((v) => v === "Payé")) return true;
  if (eleve.inscriptionPayee || eleve.autrePayee || Number(eleve.inscriptionAcompte) > 0) return true;
  const nonVide = (carte) => Object.values(carte || {}).some(Boolean);
  return nonVide(eleve.fraisPayes) || nonVide(eleve.mensAcomptes) || nonVide(eleve.fraisAcomptes);
}

/**
 * Périodes passées hors de l'école puis déclarées NON DUES au retour de
 * l'élève (champsRetour) : [{ depart, retour }] en AAAA-MM-JJ. Les entrées
 * illisibles sont ignorées.
 * @param {Record<string, any>} [eleve]
 * @returns {Array<{ depart: Date, retour: Date }>}
 */
function interruptionsNonDues(eleve = {}) {
  const liste = Array.isArray(eleve.interruptions) ? eleve.interruptions : [];
  return liste.map((i) => ({ depart: lireDate(i?.depart), retour: lireDate(i?.retour) }))
    .filter((i) => i.depart && i.retour && i.depart < i.retour);
}

// Mois entièrement passé hors de l'école : commencé après le départ et
// terminé avant le retour. Le mois du départ (entamé) et celui du retour
// (l'élève est là) restent dus.
function moisHorsEcole(debut, interruptions) {
  const suivant = new Date(debut.getFullYear(), debut.getMonth() + 1, 1);
  return interruptions.some((i) => debut > i.depart && suivant <= i.retour);
}

// Départ survenu entre le premier jour du premier mois de l'année et la fin
// de son dernier mois. Année ou mois illisibles : on ne sait pas, non.
function departDansAnnee(depart, moisAnnee, annee) {
  const debut = debutDuMois(annee, moisAnnee[0]);
  const dernier = debutDuMois(annee, moisAnnee[moisAnnee.length - 1]);
  if (!debut || !dernier) return false;
  return depart >= debut && depart < new Date(dernier.getFullYear(), dernier.getMonth() + 1, 1);
}

/**
 * Mois de `moisAnnee` (année scolaire `annee`) que l'élève doit réellement.
 * Présent : tous, sauf ceux d'une absence déclarée non due à son retour.
 * Parti : ceux qui avaient commencé le jour de son départ — le mois du départ
 * est dû, il a été entamé —, et AUCUN s'il est parti pendant l'année sans
 * rien en avoir payé (élève non réinscrit). Sans date de départ lisible, on ne sait pas
 * quand il est parti : on ne retire rien (l'écran Départs signale la date
 * manquante).
 * @param {Record<string, any>} [eleve]
 * @param {string[]} [moisAnnee]
 * @param {string} [annee]
 * @returns {string[]}
 */
export function moisExigibles(eleve = {}, moisAnnee = [], annee = anneeEcran()) {
  const interruptions = interruptionsNonDues(eleve);
  const mois = interruptions.length
    ? moisAnnee.filter((m) => {
      const debut = debutDuMois(annee, m);
      return !debut || !moisHorsEcole(debut, interruptions);
    })
    : moisAnnee;
  if (!estSorti(eleve)) return mois;
  const depart = lireDate(eleve.dateDepart);
  if (!depart) return mois;
  // Parti PENDANT cette année sans rien avoir payé : non réinscrit, il ne
  // doit rien de l'année. Les années d'avant, qu'il a suivies, restent dues.
  // Le diplômé aussi : admis au BEPC dans une école sans lycée, il est
  // déclaré « Diplômé » à la rentrée suivante (La Citadelle, 11/10/2026) —
  // c'est un non-réinscrit, il ne doit pas Octobre.
  if (departDansAnnee(depart, moisAnnee, annee) && !aDesPaiements(eleve)) return [];
  return mois.filter((m) => {
    const debut = debutDuMois(annee, m);
    // Année ou mois illisible : dans le doute, le mois reste dû.
    return !debut || debut <= depart;
  });
}

/**
 * Élève parti qui ne doit rien de l'année `annee` — aucun mois, ni
 * inscription, ni frais, ni place dans la grille des mensualités : parti
 * avant son premier mois, ou parti sans avoir rien payé de l'année (non
 * réinscrit).
 * @param {Record<string, any>} [eleve]
 * @param {string[]} [moisAnnee]
 * @param {string} [annee]
 * @returns {boolean}
 */
export function partiAvantAnnee(eleve = {}, moisAnnee = [], annee = anneeEcran()) {
  return estSorti(eleve) && !!lireDate(eleve.dateDepart) && moisAnnee.length > 0
    && moisExigibles(eleve, moisAnnee, annee).length === 0;
}

/**
 * Dernière année scolaire FRÉQUENTÉE par un élève parti : celle de sa date de
 * départ, sauf s'il est parti pendant les vacances qui la précèdent (avant
 * son premier mois de classe) — c'est alors l'année d'avant. Un élève parti
 * le 15 septembre 2026 a fini sa scolarité en 2025-2026, même si la
 * convention range le 15 septembre dans 2026-2027. "" sans date exploitable.
 * @param {Record<string, any>} [eleve]
 * @param {string[]} [moisAnnee]
 * @returns {string}
 */
export function derniereAnneeFrequentee(eleve = {}, moisAnnee = []) {
  if (!estSorti(eleve)) return "";
  const annee = anneeScolaireDeDate(eleve.dateDepart);
  if (!annee) return "";
  return partiAvantPremierMois(eleve, moisAnnee, annee) ? anneePrecedente(annee) : annee;
}

/**
 * Parti avant le premier mois de l'année `annee` — question de CALENDRIER,
 * pas d'argent : un élève dispensé, ou non réinscrit, parti en novembre a
 * bien commencé l'année (dernière année fréquentée, archive de clôture).
 * @param {Record<string, any>} [eleve]
 * @param {string[]} [moisAnnee]
 * @param {string} [annee]
 * @returns {boolean}
 */
export function partiAvantPremierMois(eleve = {}, moisAnnee = [], annee = anneeEcran()) {
  if (!estSorti(eleve) || !moisAnnee.length) return false;
  const depart = lireDate(eleve.dateDepart);
  if (!depart) return false;
  return moisAnnee.every((m) => {
    const debut = debutDuMois(annee, m);
    return !!debut && debut > depart;
  });
}

/**
 * Élèves à retenir pour une période de résultats (bulletins, fiche de
 * résultats, statistiques) : les présents, plus les partis qui ont des notes
 * sur la période — ils étaient en classe, leur rang d'alors ne doit pas
 * changer. Sans période (bilan annuel), toute note chargée compte.
 * @template {{ _id?: string }} T
 * @param {T[]} [eleves]
 * @param {Array<{ eleveId?: string, periode?: string }>} [notes]
 * @param {string | null} [periode]
 * @returns {T[]}
 */
export function elevesPourPeriode(eleves = [], notes = [], periode = null) {
  const avecNotes = new Set(notes
    .filter((n) => !periode || n.periode === periode)
    .map((n) => n.eleveId));
  return eleves.filter((e) => !estSorti(e) || avecNotes.has(e._id));
}

/**
 * Champs de départ cohérents avec le statut, au moment d'enregistrer la fiche.
 *  • Statut de sortie : la date de départ est obligatoire — c'est elle qui
 *    décide de ce que l'élève doit encore ; l'école d'accueil ne vaut que
 *    pour un transfert.
 *  • « Actif » ou « Inactif » : date, motif et destination sont effacés.
 *    Masqués dans le formulaire, ils restaient enregistrés, et l'attestation
 *    d'un élève réintégré se rédigeait au passé.
 * Les champs à vider sont mis à null (et non retirés) : la mise à jour fusionne
 * la fiche, une clé absente garderait son ancienne valeur.
 * @param {Record<string, any>} [fiche]
 * @returns {{ fiche: Record<string, any>, erreur: string | null }}
 */
/**
 * Champs à écrire pour le RETOUR d'un élève parti (↩ Réintégrer, ou statut
 * repassé à « Actif » dans sa fiche). La direction choisit, à chaque retour,
 * si les mois passés hors de l'école sont dus : s'ils ne le sont pas, la
 * période départ → retour rejoint `interruptions` (cf. moisExigibles). Sans
 * date de départ lisible, il n'y a pas de période à décompter.
 * @param {Record<string, any>} [eleve]  fiche telle qu'enregistrée (partie)
 * @param {{ dateRetour?: string, absenceDue?: boolean }} [choix]
 * @returns {{ champs: Record<string, any> | null, erreur: string | null }}
 */
export function champsRetour(eleve = {}, { dateRetour = "", absenceDue = true } = {}) {
  const champs = { statut: "Actif", dateDepart: null, motifDepart: null, destinationDepart: null };
  if (absenceDue) return { champs, erreur: null };
  const depart = lireDate(eleve.dateDepart);
  const retour = lireDate(dateRetour);
  if (!retour) return { champs: null, erreur: "Indiquez la date de retour de l'élève." };
  if (!depart) return { champs: null, erreur: "Date de départ inconnue : impossible de décompter l'absence." };
  if (retour <= depart) return { champs: null, erreur: "La date de retour doit suivre la date de départ." };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const avant = Array.isArray(eleve.interruptions) ? eleve.interruptions : [];
  return {
    champs: { ...champs, interruptions: [...avant, { depart: iso(depart), retour: iso(retour) }] },
    erreur: null,
  };
}

export function normaliserDepart(fiche = {}) {
  const sortie = STATUTS_SORTIE.includes(fiche.statut);
  if (sortie && !lireDate(fiche.dateDepart)) {
    return { fiche, erreur: "Indiquez la date de départ de l'élève." };
  }
  const aVider = sortie
    ? (fiche.statut === "Transféré" ? [] : ["destinationDepart"])
    : CHAMPS_DEPART;
  const resultat = { ...fiche };
  for (const cle of aVider) if (resultat[cle]) resultat[cle] = null;
  return { fiche: resultat, erreur: null };
}

/**
 * Date du jour en AAAA-MM-JJ (valeur d'un champ date) : défaut de la date de
 * retour.
 * @returns {string}
 */
export const aujourdhuiIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
