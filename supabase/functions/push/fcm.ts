// ════════════════════════════════════════════════════════════════════════
//  push — envoi vers l'application Android (Firebase Cloud Messaging)
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance : index.ts l'importe, les tests Node
// (tests/push-fcm.test.js) le chargent tel quel.
//
// L'application Android reçoit des messages de DONNÉES : c'est elle qui décide
// de sonner en plein écran ou d'afficher une notification simple. Son abonnement
// est une ligne push_subs ordinaire dont `subscription` vaut
// { endpoint: "fcm:<jeton>", fcm: "<jeton>" } (RLS, propriétaire, purge inchangés).
//
// Secret : FCM_SERVICE_ACCOUNT, le fichier JSON d'un compte de service Firebase.

const SITE = "https://edugest-gn.pages.dev";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const JETON_URL = "https://oauth2.googleapis.com/token";

export type CompteFcm = { project_id: string; client_email: string; private_key: string };
export type AppelFcm = { id: string; nom: string };
export type ContenuFcm = { titre?: string; corps?: string; url?: string; appel?: AppelFcm | null; appelFin?: string };
export type ResultatFcm = "ok" | "expire" | "echec";

export const estAppareilAndroid = (subscription: unknown): boolean => {
  const fcm = (subscription as { fcm?: unknown } | null)?.fcm;
  return typeof fcm === "string" && fcm.length > 0;
};

// null si le secret est absent ou incomplet : les navigateurs restent servis.
export function lireCompteFcm(secret: string | undefined): CompteFcm | null {
  if (!secret) return null;
  try {
    const compte = JSON.parse(secret);
    return compte.project_id && compte.client_email && compte.private_key ? compte : null;
  } catch {
    return null;
  }
}

const adresse = (url = "/") => (url.startsWith("https://") ? url : `${SITE}${url.startsWith("/") ? "" : "/"}${url}`);

// Valeurs texte uniquement : FCM refuse tout autre type dans `data`.
export function donneesFcm({ titre = "EduGest", corps = "", url = "/", appel = null, appelFin = "" }: ContenuFcm): Record<string, string> {
  if (appelFin) return { type: "appel-fin", appelId: appelFin };
  if (appel) {
    const lien = adresse(url);
    const decrocher = appel.id ? `${lien}${lien.includes("?") ? "&" : "?"}repondre=${encodeURIComponent(appel.id)}` : lien;
    return { type: "appel", appelId: appel.id, nom: appel.nom, url: decrocher };
  }
  return { type: "notification", titre, corps, url: adresse(url) };
}

// Appel : priorité haute pour réveiller un téléphone en veille, et durée de vie
// courte, car passé la sonnerie il est trop tard.
export function messageFcm(jeton: string, donnees: Record<string, string>) {
  const appel = donnees.type !== "notification";
  return {
    message: {
      token: jeton,
      data: donnees,
      android: appel ? { priority: "HIGH", ttl: "60s" } : { priority: "NORMAL" },
    },
  };
}

const base64Url = (octets: Uint8Array) => btoa(String.fromCharCode(...octets))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const texteBase64Url = (texte: string) => base64Url(new TextEncoder().encode(texte));

function clePrivee(pem: string) {
  const corps = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const octets = Uint8Array.from(atob(corps), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", octets, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

// Assertion signée qui s'échange contre un jeton d'accès Google (une heure).
export async function assertionGoogle(compte: CompteFcm, maintenant = Math.floor(Date.now() / 1000)): Promise<string> {
  const entete = texteBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const charge = texteBase64Url(JSON.stringify({
    iss: compte.client_email, scope: SCOPE, aud: JETON_URL, iat: maintenant, exp: maintenant + 3600,
  }));
  const a_signer = `${entete}.${charge}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await clePrivee(compte.private_key), new TextEncoder().encode(a_signer));
  return `${a_signer}.${base64Url(new Uint8Array(signature))}`;
}

export async function jetonAcces(compte: CompteFcm, requete: typeof fetch = fetch): Promise<string> {
  const reponse = await requete(JETON_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await assertionGoogle(compte),
    }),
  });
  if (!reponse.ok) throw new Error(`Jeton Google refusé (${reponse.status}).`);
  return (await reponse.json()).access_token;
}

// « expire » : application désinstallée ou jeton remplacé, la ligne se purge.
export async function envoyerFcm(
  compte: CompteFcm, acces: string, message: unknown, requete: typeof fetch = fetch,
): Promise<ResultatFcm> {
  const reponse = await requete(`https://fcm.googleapis.com/v1/projects/${compte.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${acces}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
  if (reponse.ok) return "ok";
  return reponse.status === 404 ? "expire" : "echec";
}
