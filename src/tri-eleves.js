// ══════════════════════════════════════════════════════════════
//  Tri des listes d'élèves (Mensualités, Enrôlement, École → Élèves)
// ══════════════════════════════════════════════════════════════
// Les listes arrivent déjà dans l'ordre alphabétique réglé par l'école
// (Paramètres → Affichage, schoolInfo.triEleves). Le tri choisi ici se pose
// par-dessus : Array.prototype.sort est stable, donc à égalité (même classe,
// même nombre de mois payés…) l'ordre alphabétique de l'école est conservé.

import { getEleveMensualiteSnapshot } from "./mensualite-utils.js";

// « jj/mm/aaaa » (dates saisies dans l'app) ou ISO « aaaa-mm-jj » → nombre
// comparable (aaaammjj) ; 0 si absente ou illisible.
export function cleDate(valeur) {
  const s = String(valeur || "").trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
  return 0;
}

// Date du dernier encaissement connu : mois payés, inscription, frais annexes.
export function dernierPaiement(eleve = {}) {
  const dates = [
    ...Object.values(eleve.mensDates || {}),
    eleve.inscriptionPayee ? eleve.inscriptionDate : null,
    ...Object.values(eleve.fraisPayes || {}),
  ];
  return dates.reduce((max, d) => Math.max(max, cleDate(d)), 0);
}

const comparerTexte = (a, b) => String(a || "").localeCompare(String(b || ""), "fr", { numeric: true, sensitivity: "base" });
const nomComplet = (e) => `${e.nom || ""} ${e.prenom || ""}`;

// Critères communs à toutes les listes.
const CRITERES_BASE = [
  { id: "alpha", label: "Alphabétique (réglage de l'école)" },
  { id: "nom_desc", label: "Nom de Z à A", comparer: (a, b) => comparerTexte(nomComplet(b), nomComplet(a)) },
  { id: "classe", label: "Classe", comparer: (a, b) => comparerTexte(a.classe, b.classe) },
  { id: "matricule", label: "Matricule", comparer: (a, b) => comparerTexte(a.matricule, b.matricule) },
];

// Critères de paiement : ils lisent la situation de chaque élève (snapshot).
const CRITERES_PAIEMENT = [
  { id: "reste_desc", label: "Plus grand reste à payer", paiement: true,
    comparer: (a, b, s) => s(b).reste - s(a).reste },
  { id: "impayes_desc", label: "Plus de mois impayés", paiement: true,
    comparer: (a, b, s) => s(b).nbImpayes - s(a).nbImpayes },
  { id: "payes_desc", label: "Plus de mois payés", paiement: true,
    comparer: (a, b, s) => s(b).nbPayes - s(a).nbPayes },
  { id: "paiement_recent", label: "Dernier paiement (le plus récent)", paiement: true,
    comparer: (a, b) => dernierPaiement(b) - dernierPaiement(a) },
  { id: "paiement_ancien", label: "Dernier paiement (le plus ancien)", paiement: true,
    // Jamais payé = tout en haut : ce sont eux qu'on relance d'abord.
    comparer: (a, b) => dernierPaiement(a) - dernierPaiement(b) },
];

const CRITERES_INSCRIPTION = [
  { id: "inscription_non_payee", label: "Inscription non payée d'abord",
    comparer: (a, b) => Number(!!a.inscriptionPayee) - Number(!!b.inscriptionPayee) },
];

const CRITERES_IDENTITE = [
  { id: "age_desc", label: "Âge (du plus âgé)", comparer: (a, b) => (cleDate(a.dateNaissance) || 99999999) - (cleDate(b.dateNaissance) || 99999999) },
  { id: "sexe", label: "Sexe (filles puis garçons)", comparer: (a, b) => comparerTexte(a.sexe, b.sexe) },
];

// Critères proposés par liste.
export const CRITERES_TRI = {
  mensualites: [...CRITERES_BASE, ...CRITERES_PAIEMENT, ...CRITERES_INSCRIPTION],
  enrolement: [...CRITERES_BASE, ...CRITERES_INSCRIPTION, ...CRITERES_PAIEMENT, ...CRITERES_IDENTITE],
  eleves: [...CRITERES_BASE, ...CRITERES_IDENTITE],
};

// Trie `eleves` (déjà dans l'ordre alphabétique de l'école) selon `critere`.
// `ctx` : { moisAnnee, tarifsClasses, annee } — requis pour les critères de
// paiement ; sans lui, ces critères laissent la liste telle quelle.
export function trierEleves(eleves = [], critere = "alpha", ctx = {}) {
  const def = Object.values(CRITERES_TRI).flat().find((c) => c.id === critere);
  if (!def?.comparer) return eleves;
  if (def.paiement && !ctx.moisAnnee) return eleves;
  const cache = new Map();
  const situation = (e) => {
    if (!cache.has(e)) {
      const snap = getEleveMensualiteSnapshot(e, ctx.moisAnnee || [], ctx.tarifsClasses || [], ctx.annee);
      cache.set(e, {
        reste: snap.soldeMensualites + snap.soldeInscription + snap.soldeAutre,
        nbImpayes: snap.nbImpayes,
        nbPayes: snap.nbPayes,
      });
    }
    return cache.get(e);
  };
  return [...eleves].sort((a, b) => def.comparer(a, b, situation));
}
