// ════════════════════════════════════════════════════════════════════════
//  CinetPay — Orange Money et MTN MoMo en Guinée (et 9 autres pays)
// ════════════════════════════════════════════════════════════════════════
// API CinetPay « v1 » (SDK officiels cinetpay-python / cinetpay-js) :
//   POST /v1/oauth/login  { api_key, api_password } → access_token (JWT ~24 h)
//   POST /v1/payment      → payment_url (page de paiement), payment_token,
//                            notify_token (rappelé dans chaque notification)
//   GET  /v1/payment/{id} → status : SUCCESS, FAILED, PENDING…
// Hôte déduit de la clé : sk_test_ → bac à sable, sk_live_ → production.
// Les identifiants sont ceux du compte marchand DE L'ÉCOLE (paiement_config).
//
// Module PUR : aucun accès à Deno ni à la base ; `fetch` est injecté, pour
// les tests (tests/paiement-cinetpay.test.js).
import type { Verification } from "./regles.ts";
import { lireJson } from "./outils.ts";

export const HOTES = {
  test: "https://api.cinetpay.net",
  production: "https://api.cinetpay.co",
} as const;

// Bornes d'un paiement CinetPay (validation des SDK officiels).
export const MONTANT_MIN = 100;
export const MONTANT_MAX = 2_500_000;
const URL_MAX = 120;

export type IdentifiantsCinetpay = { api_key?: string; api_password?: string };
export type Client = { prenom?: string; nom?: string; email?: string };
type Fetch = typeof fetch;

export function modeDeCle(apiKey: string | undefined): "test" | "production" | null {
  if (/^sk_test_\S+$/.test(apiKey || "")) return "test";
  if (/^sk_live_\S+$/.test(apiKey || "")) return "production";
  return null;
}

// Identifiants utilisables pour le mode demandé ; sinon, la raison en clair
// (affichée à la direction dans Paramètres → Paiement en ligne).
export function problemeIdentifiants(ids: IdentifiantsCinetpay | undefined, mode: string): string | null {
  const cle = modeDeCle(ids?.api_key);
  if (!cle) return "Clé API CinetPay invalide : elle commence par sk_test_ (test) ou sk_live_ (production).";
  if (!ids?.api_password) return "Mot de passe API CinetPay manquant.";
  if (cle !== mode) {
    return mode === "production"
      ? "Mode production : utilisez la clé sk_live_ de votre compte marchand."
      : "Mode test : utilisez la clé sk_test_ de votre compte marchand.";
  }
  return null;
}

const hote = (ids: IdentifiantsCinetpay) => HOTES[modeDeCle(ids.api_key) || "test"];

// Réponse d'erreur CinetPay → message lisible, SANS les identifiants.
const erreurApi = (etape: string, r: Response, j: Record<string, unknown>) =>
  new Error(`CinetPay ${etape} : ${String(j.description || j.message || j.status || `HTTP ${r.status}`)}`);

// ── Jeton d'accès ────────────────────────────────────────────────────────
// Gardé en mémoire le temps de vie de l'instance (une Edge Function vit
// quelques minutes) : une connexion par clé, pas une par appel.
const jetons = new Map<string, { jeton: string; expire: number }>();
const DUREE_JETON_MS = 20 * 60 * 60 * 1000;

export async function jetonAcces(ids: IdentifiantsCinetpay, f: Fetch = fetch, maintenant = Date.now()): Promise<string> {
  const cle = `${ids.api_key}`;
  const connu = jetons.get(cle);
  if (connu && connu.expire > maintenant) return connu.jeton;
  const r = await f(`${hote(ids)}/v1/oauth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ api_key: ids.api_key, api_password: ids.api_password }),
  });
  const j = await lireJson(r);
  const jeton = typeof j.access_token === "string" ? j.access_token : "";
  if (!r.ok || !jeton) throw new Error("CinetPay a refusé les identifiants de l'école (clé ou mot de passe API).");
  jetons.set(cle, { jeton, expire: maintenant + DUREE_JETON_MS });
  return jeton;
}

export function oublierJeton(ids: IdentifiantsCinetpay) {
  jetons.delete(`${ids.api_key}`);
}

// Jeton expiré ou révoqué : CinetPay répond 1002 / 1003.
const jetonPerime = (j: Record<string, unknown>) =>
  [1002, 1003].includes(Number(j.code)) || ["EXPIRED_TOKEN", "INVALID_TOKEN"].includes(String(j.status));

async function appeler(ids: IdentifiantsCinetpay, f: Fetch, chemin: string, init: RequestInit = {}) {
  for (let essai = 0; essai < 2; essai++) {
    const jeton = await jetonAcces(ids, f);
    const r = await f(`${hote(ids)}${chemin}`, {
      ...init,
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${jeton}` },
    });
    const j = await lireJson(r);
    if (essai === 0 && jetonPerime(j)) { oublierJeton(ids); continue; }
    return { r, j };
  }
  throw new Error("CinetPay : jeton d'accès refusé.");
}

// ── Création ─────────────────────────────────────────────────────────────
// Nom du payeur : 2 caractères au moins (exigence CinetPay). E-mail : celui
// du compte s'il est valide, sinon une adresse neutre (aucun reçu perdu :
// le reçu officiel est celui de l'école, dans le portail).
const EMAIL_NEUTRE = "paiement@edugest.app";
const nomValide = (s: string | undefined, defaut: string) => {
  const t = String(s || "").trim().slice(0, 255);
  return t.length >= 2 ? t : defaut;
};

export function corpsPaiement(c: {
  reference: string; montantTotal: number; devise: string; description: string;
  origine: string; urlNotification: string; urlRetour?: string; client?: Client;
}) {
  const montant = Math.round(c.montantTotal);
  if (montant < MONTANT_MIN || montant > MONTANT_MAX) {
    throw new Error(`Montant hors des limites CinetPay (${MONTANT_MIN} à ${MONTANT_MAX} par paiement).`);
  }
  // Retour par le serveur (GET comme POST acceptés), sinon l'app directement.
  const retour = c.urlRetour || `${c.origine}/?paiement=${encodeURIComponent(c.reference)}`;
  for (const u of [retour, c.urlNotification]) {
    if (u.length > URL_MAX) throw new Error(`Adresse trop longue pour CinetPay (${URL_MAX} caractères au plus).`);
  }
  const email = String(c.client?.email || "").trim();
  return {
    currency: c.devise,
    merchant_transaction_id: c.reference,
    amount: montant,
    lang: "fr",
    designation: (c.description || "Scolarité").slice(0, 255),
    client_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : EMAIL_NEUTRE,
    client_first_name: nomValide(c.client?.prenom, "Parent"),
    client_last_name: nomValide(c.client?.nom, "EduGest"),
    success_url: retour,
    failed_url: retour,
    notify_url: c.urlNotification,
    // Page CinetPay : le parent choisit Orange Money ou MTN MoMo et valide
    // sur son téléphone.
    channel: "PUSH",
  };
}

export async function creerPaiement(
  ids: IdentifiantsCinetpay, corps: ReturnType<typeof corpsPaiement>, f: Fetch = fetch,
): Promise<{ lien: string; detail: Record<string, unknown> }> {
  const { r, j } = await appeler(ids, f, "/v1/payment", { method: "POST", body: JSON.stringify(corps) });
  const lien = typeof j.payment_url === "string" ? j.payment_url : "";
  if (!r.ok || !lien) throw erreurApi("création", r, j);
  return {
    lien,
    detail: {
      payment_token: j.payment_token ?? null,
      notify_token: j.notify_token ?? null,
      transaction_id: j.transaction_id ?? null,
    },
  };
}

// ── Vérification ─────────────────────────────────────────────────────────
const ECHECS = new Set([
  "FAILED", "EXPIRED", "OTP_ERROR", "OTP_EXPIRED", "INSUFFICIENT_BALANCE",
  "USER_NOT_FOUND", "USER_IS_BLOCKED", "NOT_ALLOWED",
]);

// Statut CinetPay → statut EduGest. Le montant n'est pas renvoyé par
// CinetPay : c'est celui fixé à la création (par le serveur EduGest).
export function verificationDepuis(j: Record<string, unknown>): Verification {
  const statut = String(j.status || "");
  if (statut === "SUCCESS" || Number(j.code) === 100) {
    return { statut: "reussi", operateur: "CinetPay", detail: { transaction_id: j.transaction_id ?? null } };
  }
  if (ECHECS.has(statut)) return { statut: "echoue", detail: { motif: statut } };
  // INITIATED, PENDING, NOT_FOUND (page pas encore validée)… : on attend.
  return { statut: "en_attente" };
}

export async function verifierPaiement(ids: IdentifiantsCinetpay, reference: string, f: Fetch = fetch): Promise<Verification> {
  const { r, j } = await appeler(ids, f, `/v1/payment/${encodeURIComponent(reference)}`, { method: "GET" });
  // Inconnu de CinetPay : le parent n'a pas encore validé sa page.
  if (r.status === 404 || String(j.status) === "NOT_FOUND") return { statut: "en_attente" };
  // Toute autre erreur remonte : rien n'est conclu sans réponse claire.
  if (!r.ok) throw erreurApi("vérification", r, j);
  return verificationDepuis(j);
}

// ── Notification ─────────────────────────────────────────────────────────
// Le jeton de notification reçu doit être celui remis à la création.
export { jetonNotificationValide } from "./outils.ts";
