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

// Secret stable de l'école (mêmes valeurs à l'impression et au scan, via le
// même schoolInfo du contexte).
export function schoolSecret(schoolInfo = {}) {
  return String(schoolInfo.id || schoolInfo.code || schoolInfo.schoolId || schoolInfo.nom || "edugest");
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
// chiffré ou si le secret ne correspond pas (autre école / falsification).
export async function decryptQrPayload(token, secret) {
  if (typeof token !== "string" || !token.startsWith(PREFIX)) return null;
  try {
    const combined = b64urlDecode(token.slice(PREFIX.length));
    const iv = combined.slice(0, 12);
    const ct = combined.slice(12);
    const key = await deriveKey(secret);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
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
