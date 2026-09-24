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
//    année dont il n'a vu aucun mois (moisExigibles, partiAvantAnnee) ;
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
 * Mois de `moisAnnee` (année scolaire `annee`) que l'élève doit réellement.
 * Présent : tous. Parti : ceux qui avaient commencé le jour de son départ —
 * le mois du départ est dû, il a été entamé. Sans date de départ lisible, on
 * ne sait pas quand il est parti : on ne retire rien (l'écran Départs signale
 * la date manquante).
 * @param {Record<string, any>} [eleve]
 * @param {string[]} [moisAnnee]
 * @param {string} [annee]
 * @returns {string[]}
 */
export function moisExigibles(eleve = {}, moisAnnee = [], annee = anneeEcran()) {
  if (!estSorti(eleve)) return moisAnnee;
  const depart = lireDate(eleve.dateDepart);
  if (!depart) return moisAnnee;
  return moisAnnee.filter((mois) => {
    const debut = debutDuMois(annee, mois);
    // Année ou mois illisible : dans le doute, le mois reste dû.
    return !debut || debut <= depart;
  });
}

/**
 * Parti avant le premier mois de l'année `annee` : il n'a rien fait cette
 * année-là — aucun mois dû, ni inscription, ni place dans les listes.
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
  return partiAvantAnnee(eleve, moisAnnee, annee) ? anneePrecedente(annee) : annee;
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
