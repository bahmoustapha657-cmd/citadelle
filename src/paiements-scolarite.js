// ══════════════════════════════════════════════════════════════════════════
//  Paiements de scolarité : montant libre, tranches, acomptes — logique pure
// ══════════════════════════════════════════════════════════════════════════
// Un parent ne paie pas toujours « un mois » : il apporte un montant (250 000
// pour une mensualité de 110 000), règle une tranche (T1 = Octobre–Décembre)
// ou verse la cantine en deux fois. Ce module traduit un versement en champs
// de fiche élève et en lignes de journal, sans rien écrire lui-même :
// payment-actions applique, les tests vérifient.
//
// Règles :
//  • un montant libre paie les mois dans l'ordre de l'année, du plus ancien
//    au plus récent ; ce qui ne suffit pas à solder un mois devient un
//    ACOMPTE sur ce mois (mensAcomptes) — même chose pour un frais
//    (fraisAcomptes) ou l'inscription (inscriptionAcompte) ;
//  • le dû s'entend après dispense : c'est ce que le parent paie réellement ;
//  • un mois ou un frais soldé fige le total versé (mensMontants,
//    fraisMontants, inscriptionMontant), comme un paiement en une fois ;
//  • rien ne s'encaisse au-delà du reste dû.

import { moisExigibles } from "./depart-utils.js";
import { estExonereTotal } from "./exoneration-utils.js";
import {
  acompteFrais,
  acompteInscription,
  acompteMois,
  montantDuMois,
  montantMoisPaye,
} from "./mensualite-utils.js";

const entier = (valeur) => Math.max(0, Math.round(Number(valeur) || 0));

// ── Tranches (groupes de mois) ──────────────────────────────────────────────
// Réglage d'école (ecoles.extra.tranchesPaiement) : [{ nom, mois: [...] }].

export const nomTrancheParDefaut = (index) => (index === 0 ? "1re tranche" : `${index + 1}e tranche`);

// Tranches utilisables avec les mois de l'année : chaque mois n'appartient qu'à
// une tranche, dans l'ordre de l'année ; une tranche vide disparaît. Un mois
// retiré de l'année (école qui démarre plus tard) sort de sa tranche.
export function tranchesValides(tranches, moisAnnee = []) {
  if (!Array.isArray(tranches)) return [];
  const pris = new Set();
  const valides = [];
  for (const tranche of tranches) {
    const mois = moisAnnee.filter((m) => (tranche?.mois || []).includes(m) && !pris.has(m));
    if (!mois.length) continue;
    mois.forEach((m) => pris.add(m));
    valides.push({ nom: String(tranche?.nom || "").trim() || nomTrancheParDefaut(valides.length), mois });
  }
  return valides;
}

// Découpage proposé : `nb` tranches de mois consécutifs, aussi égales que
// possible — les premières prennent le mois en trop (10 mois en 3 : 4-3-3).
export function proposerTranches(moisAnnee = [], nb = 3) {
  const n = Math.max(1, Math.min(Math.round(nb) || 1, moisAnnee.length || 1));
  const taille = Math.floor(moisAnnee.length / n);
  const surplus = moisAnnee.length % n;
  const tranches = [];
  let debut = 0;
  for (let i = 0; i < n; i += 1) {
    const longueur = taille + (i < surplus ? 1 : 0);
    tranches.push({ nom: nomTrancheParDefaut(i), mois: moisAnnee.slice(debut, debut + longueur) });
    debut += longueur;
  }
  return tranches.filter((t) => t.mois.length);
}

// Index de la tranche d'un mois (-1 hors tranche).
export const trancheDuMois = (tranches = [], mois) => tranches.findIndex((t) => t.mois.includes(mois));

// « Octobre–Décembre » (ou « Octobre » pour une tranche d'un mois).
export const periodeTranche = (tranche) => {
  const mois = tranche?.mois || [];
  return mois.length > 1 ? `${mois[0]}–${mois[mois.length - 1]}` : (mois[0] || "");
};

// ── Mois ────────────────────────────────────────────────────────────────────

// État de chaque mois pour cet élève : payé, entamé (acompte), impayé,
// dispensé, ou non dû (après le départ d'un élève parti — `annee` situe les
// mois, cf. depart-utils). `du` = mensualité après dispense ; `verse` =
// montant figé d'un mois payé, ou acompte d'un mois entamé ; `reste` = ce
// qu'il reste à verser.
export function etatsMois(eleve = {}, moisAnnee = [], mensualite = 0, annee) {
  const mens = eleve.mens || {};
  const du = montantDuMois(eleve, mensualite);
  const dispense = estExonereTotal(eleve, "mensualites");
  const exigibles = new Set(moisExigibles(eleve, moisAnnee, annee));
  return moisAnnee.map((mois) => {
    if (mens[mois] === "Payé") {
      return { mois, statut: "paye", du, verse: montantMoisPaye(eleve, mois, mensualite), reste: 0 };
    }
    const acompte = acompteMois(eleve, mois);
    if (!exigibles.has(mois)) return { mois, statut: "nonDu", du: 0, verse: acompte, reste: 0 };
    const reste = Math.max(0, du - acompte);
    const statut = acompte > 0 ? "partiel" : dispense ? "exonere" : "impaye";
    return { mois, statut, du, verse: acompte, reste };
  });
}

// Répartit `montant` sur les mois dans l'ordre donné : chaque mois est soldé
// tant que le montant suffit, le reliquat devient un acompte sur le suivant.
// `nonAffecte` : ce qui dépasse le reste dû de ces mois.
export function repartirSurMois(etats = [], montant = 0) {
  let disponible = entier(montant);
  const affectations = [];
  for (const etat of etats) {
    if (disponible <= 0) break;
    if (etat.reste <= 0) continue;
    const part = Math.min(disponible, etat.reste);
    affectations.push({ mois: etat.mois, montant: part, solde: part === etat.reste, dejaVerse: etat.verse });
    disponible -= part;
  }
  return { affectations, nonAffecte: disponible };
}

// Libellé d'une affectation au journal et sur le reçu.
export const libelleAffectation = ({ mois, solde, dejaVerse }) => (
  !solde ? `${mois} (acompte)` : dejaVerse > 0 ? `${mois} (solde)` : mois
);

// Champs de fiche après les affectations : un mois soldé passe « Payé » et fige
// le total versé (acompte compris) ; un mois entamé porte son acompte.
export function champsVersementMois(eleve = {}, affectations = [], date = "") {
  const mens = { ...(eleve.mens || {}) };
  const mensDates = { ...(eleve.mensDates || {}) };
  const mensMontants = { ...(eleve.mensMontants || {}) };
  const mensAcomptes = { ...(eleve.mensAcomptes || {}) };
  for (const { mois, montant, solde } of affectations) {
    const total = acompteMois(eleve, mois) + montant;
    if (solde) {
      mens[mois] = "Payé";
      mensDates[mois] = date;
      mensMontants[mois] = total;
      delete mensAcomptes[mois];
    } else {
      mensAcomptes[mois] = total;
    }
  }
  return { mens, mensDates, mensMontants, mensAcomptes };
}

// ── Postes ponctuels : inscription et frais annexes ─────────────────────────

const acomptePoste = (eleve, poste) => (poste === "inscription" ? acompteInscription(eleve) : acompteFrais(eleve, poste));

// Champs de fiche pour un versement sur un poste ponctuel. `duNet` : ce que
// l'élève doit pour ce poste (dispense déduite). Un versement qui atteint le
// reste solde le poste et fige le total ; sinon il s'ajoute à l'acompte.
export function champsVersementPoste(eleve = {}, poste, montant = 0, duNet = 0, date = "") {
  const deja = acomptePoste(eleve, poste);
  const reste = Math.max(0, entier(duNet) - deja);
  const part = Math.min(entier(montant), reste);
  const solde = reste > 0 && part === reste;
  const total = deja + part;
  if (poste === "inscription") {
    return {
      part, solde,
      champs: solde
        ? { inscriptionPayee: true, inscriptionDate: date, inscriptionMontant: total, inscriptionAcompte: null }
        : { inscriptionAcompte: total },
    };
  }
  const fraisAcomptes = { ...(eleve.fraisAcomptes || {}) };
  if (!solde) {
    fraisAcomptes[poste] = total;
    return { part, solde, champs: { fraisAcomptes } };
  }
  delete fraisAcomptes[poste];
  return {
    part, solde,
    champs: {
      fraisPayes: { ...(eleve.fraisPayes || {}), [poste]: date },
      fraisMontants: { ...(eleve.fraisMontants || {}), [poste]: total },
      fraisAcomptes,
    },
  };
}

// Annulation d'un acompte (erreur de saisie) : champs à écrire et montant à
// contre-passer au journal. `type` : "mois" (cle = mois), "inscription" ou
// "frais" (cle = id du frais).
export function champsRetraitAcompte(eleve = {}, { type, cle } = {}) {
  if (type === "mois") {
    const mensAcomptes = { ...(eleve.mensAcomptes || {}) };
    delete mensAcomptes[cle];
    return { montant: acompteMois(eleve, cle), champs: { mensAcomptes } };
  }
  if (type === "inscription") {
    return { montant: acompteInscription(eleve), champs: { inscriptionAcompte: null } };
  }
  const fraisAcomptes = { ...(eleve.fraisAcomptes || {}) };
  delete fraisAcomptes[cle];
  return { montant: acompteFrais(eleve, cle), champs: { fraisAcomptes } };
}

// ── Versement complet ───────────────────────────────────────────────────────
// `cible` :
//   { type: "mois", mois: [...] }                  — mensualités (toute l'année
//                                                    ou les mois d'une tranche)
//   { type: "poste", poste, label, duNet }         — inscription ou frais
// Renvoie { ok: true, champs, lignes, total, moisSoldes } — `lignes` pour le
// journal (une par mois ou poste touché) — ou { ok: false, raison, reste }.
// `annee` : celle des fiches (règle des départs, cf. etatsMois).
export function planVersement({ eleve = {}, cible, montant, date = "", mensualite = 0, annee }) {
  const somme = entier(montant);
  if (!cible) return { ok: false, raison: "cible", reste: 0 };
  if (cible.type === "mois") {
    const etats = etatsMois(eleve, cible.mois || [], mensualite, annee);
    const reste = etats.reduce((s, e) => s + e.reste, 0);
    if (somme <= 0) return { ok: false, raison: "montant", reste };
    if (somme > reste) return { ok: false, raison: "depasse", reste };
    const { affectations } = repartirSurMois(etats, somme);
    return {
      ok: true,
      total: somme,
      affectations,
      moisSoldes: affectations.filter((a) => a.solde).map((a) => a.mois),
      champs: champsVersementMois(eleve, affectations, date),
      lignes: affectations.map((a) => ({
        type: "mensualite", mois: a.mois, libelle: libelleAffectation(a), montant: a.montant, solde: a.solde,
      })),
    };
  }
  const { poste, label = poste, duNet = 0 } = cible;
  const reste = Math.max(0, entier(duNet) - acomptePoste(eleve, poste));
  if (somme <= 0) return { ok: false, raison: "montant", reste };
  if (somme > reste) return { ok: false, raison: "depasse", reste };
  const { champs, part, solde } = champsVersementPoste(eleve, poste, somme, duNet, date);
  const deja = acomptePoste(eleve, poste);
  return {
    ok: true,
    total: part,
    moisSoldes: [],
    champs,
    lignes: [{
      type: poste === "inscription" ? "inscription" : "frais",
      mois: poste,
      libelle: !solde ? `${label} (acompte)` : deja > 0 ? `${label} (solde)` : label,
      montant: part,
      solde,
    }],
  };
}
