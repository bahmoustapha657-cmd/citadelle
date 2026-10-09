// Écritures refusées par le serveur, ou sans effet — JAMAIS en silence.
//
// Supabase (PostgREST) ne lève AUCUNE erreur quand la RLS refuse une
// modification ou une suppression : la requête réussit et touche 0 ligne.
// L'écran affichait « enregistré », la donnée n'avait pas bougé — puis la
// modification « disparaissait » au rechargement (journal muet du comptable,
// livrets hors ligne, section perdue… cf. historique des incidents). Hors
// ligne, le connecteur PowerSync abandonnait ces refus dans la console.
//
// Ce module rend tout refus VISIBLE :
//   1. une erreur explicite (EcritureSansEffet) pour l'appelant ;
//   2. un journal sur l'appareil (50 dernières, pour le support) ;
//   3. un événement global → avertissement à l'écran (use-app-shell) ;
//   4. Sentry, s'il est actif.
// Volontairement sans dépendance navigateur ni Supabase : testable sous Node.
import { captureClientError } from "../sentry.js";

export const EVENEMENT_ECRITURE_REFUSEE = "edugest:ecriture-refusee";
const CLE_JOURNAL = "LC_ecritures_refusees";
const TAILLE_JOURNAL = 50;

export class EcritureSansEffet extends Error {
  constructor(table, operation) {
    super(`Modification non enregistrée (${table}) : refusée par le serveur — droits insuffisants, ou fiche supprimée entre-temps.`);
    this.name = "EcritureSansEffet";
    this.table = table;
    this.operation = operation;
  }
}

export function lireJournalRefus(stockage = globalThis.localStorage) {
  try {
    const brut = stockage?.getItem(CLE_JOURNAL);
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}

export function signalerEcritureRefusee(
  { table, operation, id = null, message = "", horsLigne = false },
  { stockage = globalThis.localStorage, cible = globalThis.window } = {},
) {
  const entree = {
    table, operation, id,
    message: String(message || "").slice(0, 300),
    horsLigne: !!horsLigne,
    le: new Date().toISOString(),
  };
  try {
    stockage?.setItem(CLE_JOURNAL, JSON.stringify([entree, ...lireJournalRefus(stockage)].slice(0, TAILLE_JOURNAL)));
  } catch { /* stockage plein ou indisponible : l'alerte passe quand même */ }
  try {
    cible?.dispatchEvent?.(new CustomEvent(EVENEMENT_ECRITURE_REFUSEE, { detail: entree }));
  } catch { /* hors navigateur */ }
  // Sentry s'il est actif, la console sinon.
  try {
    captureClientError(new Error(`Écriture refusée : ${table} ${operation}`), entree);
  } catch { /* jamais bloquant */ }
  return entree;
}

// Résultat d'un update / delete supabase-js demandé avec { count: "exact" } :
// erreur → exception ; 0 ligne touchée → EcritureSansEffet. N'alerte pas
// (le connecteur PowerSync alerte lui-même, une fois, en précisant « hors ligne »).
export function verifierEffet({ error, count } = {}, table, operation) {
  if (error) throw new Error(error.message);
  if (count === 0) throw new EcritureSansEffet(table, operation);
}

// Chemin EN LIGNE : même contrôle, et l'utilisateur est averti.
export function exigerEffet(resultat, { table, operation, id = null }, options) {
  try {
    verifierEffet(resultat, table, operation);
  } catch (e) {
    if (e instanceof EcritureSansEffet) {
      signalerEcritureRefusee({ table, operation, id, message: e.message }, options);
    }
    throw e;
  }
}

// Texte de l'avertissement, pour `n` refus arrivés ensemble.
export function messageRefus(n, horsLigne) {
  const quoi = n > 1 ? `${n} modifications n'ont pas été enregistrées` : "Une modification n'a pas été enregistrée";
  const ou = horsLigne ? " (faite(s) hors ligne, refusée(s) au retour du réseau)" : "";
  return `⚠️ ${quoi}${ou} : refus du serveur — droits insuffisants ou fiche supprimée entre-temps. Vérifiez et ressaisissez si besoin.`;
}
