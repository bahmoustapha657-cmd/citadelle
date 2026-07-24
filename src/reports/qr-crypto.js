// Chiffrement des QR codes des documents (bulletins, reçus, fiches de paie).
// Objectif : qu'un lecteur QR grand public n'affiche QUE du charabia — seul le
// scanner intégré d'EduGest (côté direction) peut déchiffrer le contenu.
//
// AES-GCM (Web Crypto), clé dérivée par SHA-256 d'un sel applicatif + un secret
// propre à l'école. Une école ne peut donc déchiffrer que SES propres documents.
// Niveau « obfuscation forte » : le secret vit côté client, ce qui suffit à
// l'usage visé (anti-lecture/anti-falsification courante), pas à un secret d'État.

const PEPPER = "EduGest-QR-v1";
const PREFIX = "EQR1.";

// Secrets candidats de l'école, du PLUS STABLE au moins stable.
//
// `code` (le code école, immuable — c'est la clé d'identification de l'école
// partout dans l'app) vient en tête : c'est lui qui sert à CHIFFRER. Les
// suivants ne servent qu'à DÉCHIFFRER, pour rester compatible avec les
// documents DÉJÀ IMPRIMÉS : jusqu'au 2026-07-24, ni Firebase ni Supabase
// n'exposaient `code`/`id`/`schoolId` dans schoolInfo, et le secret retombait
// donc sur le NOM de l'école — un renommage (accent corrigé, changement de
// dénomination) rendait alors illisibles tous les QR déjà en circulation.
//
// À NE PAS FAIRE ÉVOLUER À LA LÉGÈRE : le secret doit rester stable dans le
// temps, et toute valeur retirée de cette liste rend définitivement illisibles
// les documents imprimés avec elle. On n'y normalise donc rien (ni trim, ni
// casse, ni accents) : la chaîne doit être reproduite à l'octet près.
export function schoolSecretCandidates(schoolInfo = {}) {
  const candidats = [schoolInfo.code, schoolInfo.id, schoolInfo.schoolId, schoolInfo.nom, "edugest"];
  const vus = new Set();
  const liste = [];
  candidats.forEach((v) => {
    const s = v === undefined || v === null ? "" : String(v);
    if (!s || vus.has(s)) return;
    vus.add(s);
    liste.push(s);
  });
  return liste;
}

// Secret utilisé à l'IMPRESSION : le plus stable disponible.
export function schoolSecret(schoolInfo = {}) {
  return schoolSecretCandidates(schoolInfo)[0];
}

function b64urlEncode(bytes) {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(secret) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(`${PEPPER}|${secret || ""}`));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// Chiffre un texte → jeton "EQR1.<base64url(iv|ciphertext)>". En cas d'échec
// (Web Crypto indisponible…) on renvoie le texte tel quel pour ne pas perdre le QR.
export async function encryptQrPayload(text, secret) {
  try {
    const key = await deriveKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, new TextEncoder().encode(String(text)),
    ));
    const combined = new Uint8Array(iv.length + ct.length);
    combined.set(iv);
    combined.set(ct, iv.length);
    return PREFIX + b64urlEncode(combined);
  } catch {
    return String(text);
  }
}

// Déchiffre un jeton EQR1. → texte, ou null si ce n'est pas un QR EduGest
// chiffré ou si aucun secret ne correspond (autre école / falsification).
//
// `secret` accepte une LISTE de secrets candidats (cf. schoolSecretCandidates) :
// on les essaie dans l'ordre, le premier qui déchiffre gagne. C'est ce qui rend
// le scanner tolérant aux renommages d'école et aux documents anciens, imprimés
// avec un secret qui n'est plus celui du chiffrement. Aucun risque de faux
// positif : AES-GCM est authentifié, un mauvais secret échoue toujours.
export async function decryptQrPayload(token, secret) {
  if (typeof token !== "string" || !token.startsWith(PREFIX)) return null;
  let iv;
  let ct;
  try {
    const combined = b64urlDecode(token.slice(PREFIX.length));
    iv = combined.slice(0, 12);
    ct = combined.slice(12);
  } catch {
    return null; // jeton tronqué / base64 invalide
  }
  const secrets = Array.isArray(secret) ? secret : [secret];
  for (const s of secrets) {
    try {
      const key = await deriveKey(s);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch { /* secret suivant */ }
  }
  return null;
}

// Parse une charge utile "clé:valeur|clé:valeur" en objet (pour l'affichage scanner).
export function parseQrPayload(text = "") {
  const obj = {};
  String(text).split("|").forEach((pair) => {
    const idx = pair.indexOf(":");
    if (idx > 0) obj[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return obj;
}
