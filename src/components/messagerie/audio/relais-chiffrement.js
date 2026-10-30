// ── Relais de secours : chiffrement de bout en bout de la voix ──────────────
// Supabase transporte les paquets sans pouvoir les lire. Chaque appel a ses
// propres clés, créées sur les deux appareils (ECDH P-256, puis AES-GCM 256) :
// seules les clés publiques voyagent, dans l'offre et la réponse de msg_appels.
// C'est le niveau de confiance de WebRTC, dont les empreintes passent par le
// même chemin. Sans clé commune, pas de relais : jamais de voix en clair.
import { depuisBase64, versBase64 } from "./relais-audio-logic";

const ECDH = { name: "ECDH", namedCurve: "P-256" };
const LONGUEUR_IV = 12;
const texte = new TextEncoder();

// La clé privée n'est pas exportable et disparaît avec l'appel. `publique`
// part vers l'autre côté.
export async function creerEchangeCles() {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(ECDH, false, ["deriveBits"]);
  return { privee: privateKey, publique: versBase64(new Uint8Array(await crypto.subtle.exportKey("raw", publicKey))) };
}

// Clé AES propre à cet appel ; null si l'échange n'a pas pu se faire (appareil
// sans WebCrypto, ou clé absente : correspondant sur une ancienne version).
export async function cleCommune(echange, publiqueDistante, appelId) {
  if (!echange || !publiqueDistante || !appelId) return null;
  try {
    const distante = await crypto.subtle.importKey("raw", depuisBase64(publiqueDistante), ECDH, false, []);
    const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: distante }, echange.privee, 256);
    const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: texte.encode(appelId), info: texte.encode("edugest-relais-appel") },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

// Vecteur aléatoire en tête de paquet : les deux sens partagent la même clé.
export async function chiffrerPaquet(cle, octets) {
  const iv = crypto.getRandomValues(new Uint8Array(LONGUEUR_IV));
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cle, octets));
  const paquet = new Uint8Array(LONGUEUR_IV + chiffre.length);
  paquet.set(iv);
  paquet.set(chiffre, LONGUEUR_IV);
  return paquet;
}

// Rejette un paquet modifié ou chiffré avec une autre clé.
export async function dechiffrerPaquet(cle, paquet) {
  const iv = paquet.subarray(0, LONGUEUR_IV);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cle, paquet.subarray(LONGUEUR_IV)));
}
