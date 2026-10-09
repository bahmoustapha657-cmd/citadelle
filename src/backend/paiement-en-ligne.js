// ── Paiement en ligne (Mobile Money via un agrégateur) ─────────────────────
// Tout passe par l'Edge Function `paiement` : le navigateur ne crée ni ne
// valide jamais un paiement lui-même, il ne fait que demander et LIRE.
import { getSupabase } from "../supabaseClient";

async function appeler(action, corps = {}) {
  const { data, error } = await getSupabase().functions.invoke("paiement", { body: { action, ...corps } });
  if (error) {
    let message = "Service de paiement indisponible.";
    try { message = (await error.context?.json())?.error || message; } catch { /* message par défaut */ }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.error || "Réponse vide du service de paiement.");
  return data;
}

// { actif, fournisseur, libelle, fraisPourcent, mode, plafond }
// plafond : plus grosse scolarité payable en une fois (null = sans limite).
export const etatPaiementEnLigne = () => appeler("etat");

// { annee, cibles: [{ cle, label, detail, reste, propose }], fraisPourcent, plafond }
export const ciblesPaiement = (eleveId) => appeler("cibles", { eleveId });

// Direction : réglages de l'école, identifiants MASQUÉS
// { fournisseur, mode, actif, fraisPourcent, cle, motDePassePose, fournisseurs }
export const lireConfigPaiement = () => appeler("config").then((d) => d.config);

// Direction : enregistre (identifiants essayés auprès de l'opérateur si
// actif). Un identifiant laissé vide garde la valeur enregistrée.
export const configurerPaiement = (saisie) => appeler("configurer", saisie).then((d) => d.config);

// { reference, lien, montant, frais, total }
export const initierPaiement = ({ eleveId, cle, montant }) => appeler("initier", { eleveId, cle, montant });

// { paiement: { reference, statut, montant, frais, lignes, motif… } }
export const statutPaiement = (reference) => appeler("statut", { reference }).then((d) => d.paiement);

export const simulerPaiement = (reference, resultat) =>
  appeler("simuler", { reference, resultat }).then((d) => d.paiement);

// Frais affichés avant de payer : même calcul que le serveur (arrondi au
// franc supérieur). Le serveur reste l'autorité.
export const fraisPaiement = (montant, pourcent) =>
  (montant > 0 && pourcent > 0 ? Math.ceil((montant * pourcent) / 100) : 0);

// Paiements en ligne de l'école (compta) ou des enfants (parent) — la RLS
// filtre. Les plus récents d'abord.
export async function listerPaiementsEnLigne({ limite = 200 } = {}) {
  const { data, error } = await getSupabase().from("paiements_en_ligne")
    .select("id, reference, statut, fournisseur, montant, frais, devise, cible, annee, detail, created_at, impute_le, eleve_id, eleve_nom, eleves(nom, prenom, classe)")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return data || [];
}

// Paramètres d'adresse posés au retour de la page de paiement (ou par la
// page de simulation). Retirés une fois traités.
export function lireRetourPaiement(location = window.location) {
  const params = new URLSearchParams(location.search);
  const simule = params.get("paiement-simule");
  if (simule) return { reference: simule, simulation: true };
  const reference = params.get("paiement");
  return reference ? { reference, simulation: false } : null;
}

export function nettoyerRetourPaiement() {
  const url = new URL(window.location.href);
  url.searchParams.delete("paiement");
  url.searchParams.delete("paiement-simule");
  window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
}
