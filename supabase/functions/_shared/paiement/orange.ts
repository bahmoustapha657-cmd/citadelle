// ════════════════════════════════════════════════════════════════════════
//  Orange Money Guinée — en direct (API « Orange Money Web Payment »)
// ════════════════════════════════════════════════════════════════════════
// L'argent arrive DIRECTEMENT sur le compte marchand Orange Money de l'école :
// aucun intermédiaire ne le détient. Prérequis côté école :
//   • un compte marchand Orange Money (agence Orange, vérification KYA) ;
//   • l'abonnement à « Orange Money Web Payment » (developer.orange.com) :
//     Client ID + Client Secret de l'application, et la clé marchand
//     (merchant key) remise par Orange.
//
// API (https://api.orange.com) :
//   POST /oauth/v3/token                       Basic base64(client_id:secret),
//                                              grant_type=client_credentials
//   POST /orange-money-webpay/{pays}/v1/webpayment
//        → pay_token, payment_url, notif_token (généré par Orange)
//   POST /orange-money-webpay/{pays}/v1/transactionstatus
//        { order_id, amount, pay_token } → status SUCCESS / FAILED / EXPIRED…
//   Notification sur notif_url : { status, notif_token, txnid } — SANS
//   référence ni montant : la référence voyage dans l'adresse (&ref=…), le
//   notif_token authentifie, et le paiement est toujours REVÉRIFIÉ.
// Bac à sable : chemin « dev », monnaie « OUV » ; production : « gn », GNF.
//
// Module PUR : `fetch` injecté (tests/paiement-orange.test.js).
import type { Verification } from "./regles.ts";
import { lireJson } from "./outils.ts";

export const HOTE = "https://api.orange.com";
export const ENVIRONNEMENTS = {
  test: { pays: "dev", devise: "OUV" },
  production: { pays: "gn", devise: "GNF" },
} as const;

export type IdentifiantsOrange = { client_id?: string; client_secret?: string; merchant_key?: string };
type Fetch = typeof fetch;

export function problemeIdentifiants(ids: IdentifiantsOrange | undefined): string | null {
  if (!ids?.client_id) return "Client ID Orange Developer manquant.";
  if (!ids?.client_secret) return "Client Secret Orange Developer manquant.";
  if (!ids?.merchant_key) return "Clé marchand Orange Money (merchant key) manquante.";
  return null;
}

const environnement = (mode: string) => ENVIRONNEMENTS[mode === "production" ? "production" : "test"];

// ── Jeton d'accès ────────────────────────────────────────────────────────
const jetons = new Map<string, { jeton: string; expire: number }>();

const base64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

export async function jetonAcces(ids: IdentifiantsOrange, f: Fetch = fetch, maintenant = Date.now()): Promise<string> {
  const cle = `${ids.client_id}`;
  const connu = jetons.get(cle);
  if (connu && connu.expire > maintenant) return connu.jeton;
  const r = await f(`${HOTE}/oauth/v3/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${base64(`${ids.client_id}:${ids.client_secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });
  const j = await lireJson(r);
  const jeton = typeof j.access_token === "string" ? j.access_token : "";
  if (!r.ok || !jeton) throw new Error("Orange a refusé les identifiants de l'école (Client ID ou Client Secret).");
  // Marge d'une minute sur la durée annoncée (une heure par défaut).
  const duree = (Number(j.expires_in) || 3600) - 60;
  jetons.set(cle, { jeton, expire: maintenant + Math.max(60, duree) * 1000 });
  return jeton;
}

export function oublierJeton(ids: IdentifiantsOrange) {
  jetons.delete(`${ids.client_id}`);
}

async function appeler(ids: IdentifiantsOrange, f: Fetch, chemin: string, corps: unknown) {
  for (let essai = 0; essai < 2; essai++) {
    const jeton = await jetonAcces(ids, f);
    const r = await f(`${HOTE}${chemin}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(corps),
    });
    // Jeton expiré ou révoqué : une reconnexion, puis on réessaie.
    if (r.status === 401 && essai === 0) { oublierJeton(ids); continue; }
    return { r, j: await lireJson(r) };
  }
  throw new Error("Orange : jeton d'accès refusé.");
}

const erreurApi = (etape: string, r: Response, j: Record<string, unknown>) =>
  new Error(`Orange Money ${etape} : ${String(j.description || j.message || j.status || `HTTP ${r.status}`)}`);

// ── Création ─────────────────────────────────────────────────────────────
// `reference` : libellé affiché au client, 30 caractères au plus (au-delà,
// Orange répond 400 code 24).
export function corpsPaiement(c: {
  reference: string; montantTotal: number; description: string; origine: string;
  urlNotification: string; urlRetour?: string; merchantKey: string; mode: string;
}) {
  const montant = Math.round(c.montantTotal);
  if (!(montant > 0)) throw new Error("Montant invalide.");
  const retour = c.urlRetour || `${c.origine}/?paiement=${encodeURIComponent(c.reference)}`;
  // La notification d'Orange ne dit pas QUEL paiement : la référence est
  // ajoutée à l'adresse.
  const notification = `${c.urlNotification}${c.urlNotification.includes("?") ? "&" : "?"}ref=${encodeURIComponent(c.reference)}`;
  return {
    merchant_key: c.merchantKey,
    currency: environnement(c.mode).devise,
    order_id: c.reference,
    amount: montant,
    return_url: retour,
    cancel_url: retour,
    notif_url: notification,
    lang: "fr",
    reference: (c.description || "Scolarite").slice(0, 30),
  };
}

export async function creerPaiement(
  ids: IdentifiantsOrange, mode: string, corps: ReturnType<typeof corpsPaiement>, f: Fetch = fetch,
): Promise<{ lien: string; detail: Record<string, unknown> }> {
  const { r, j } = await appeler(ids, f, `/orange-money-webpay/${environnement(mode).pays}/v1/webpayment`, corps);
  const lien = typeof j.payment_url === "string" ? j.payment_url : "";
  if (!r.ok || !lien || typeof j.pay_token !== "string") throw erreurApi("création", r, j);
  return {
    lien,
    // pay_token : pour la vérification ; notif_token (celui d'ORANGE) :
    // pour authentifier la notification ; montant envoyé : la vérification
    // le redemande tel quel.
    detail: { pay_token: j.pay_token, notif_token: j.notif_token ?? null, montant_envoye: corps.amount },
  };
}

// ── Vérification ─────────────────────────────────────────────────────────
export function verificationDepuis(j: Record<string, unknown>): Verification {
  const statut = String(j.status || "").toUpperCase();
  if (statut === "SUCCESS") {
    return { statut: "reussi", operateur: "Orange Money", detail: { txnid: j.txnid ?? null } };
  }
  if (statut === "FAILED" || statut === "EXPIRED") return { statut: "echoue", detail: { motif: statut } };
  // INITIATED, PENDING : le parent n'a pas encore validé.
  return { statut: "en_attente" };
}

export async function verifierPaiement(
  ids: IdentifiantsOrange, mode: string,
  p: { reference: string; montant: number | string; frais: number | string; detail?: Record<string, unknown> },
  f: Fetch = fetch,
): Promise<Verification> {
  const d = p.detail || {};
  // Sans pay_token, Orange ne peut rien dire de ce paiement.
  if (typeof d.pay_token !== "string" || !d.pay_token) return { statut: "en_attente" };
  const amount = Number(d.montant_envoye) || Math.round(Number(p.montant) + Number(p.frais));
  const { r, j } = await appeler(ids, f, `/orange-money-webpay/${environnement(mode).pays}/v1/transactionstatus`, {
    order_id: p.reference, amount, pay_token: d.pay_token,
  });
  if (!r.ok) throw erreurApi("vérification", r, j);
  return verificationDepuis(j);
}
