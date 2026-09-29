// Chiffrement des QR codes des documents (bulletins, reçus, fiches de paie).
// Objectif : qu'un lecteur QR grand public n'affiche QUE du charabia — seul le
// scanner intégré d'EduGest (côté direction) peut déchiffrer le contenu.
//
// AES-GCM (Web Crypto), clé dérivée par SHA-256 d'un sel applicatif + un secret
// propre à l'école. Une école ne peut donc déchiffrer que SES propres documents.
// Niveau « obfuscation forte » : le secret vit côté client, ce qui suffit à
// l'usage visé (anti-lecture/anti-falsification courante), pas à un secret d'État.

const PEPPER = "EduGest-QR-v1";
// Deux formats de jeton, même chiffrement (même clé, même AES-GCM) :
// - EQR2 (émis depuis 2026-09) : base45, dont l'alphabet est EXACTEMENT celui
//   du mode alphanumérique des QR (5,5 bits par caractère au lieu de 8 en
//   mode octet). Le QR obtenu a ~40 % de modules en moins par côté qu'en EQR1,
//   donc des modules bien plus gros à taille imprimée égale : c'est ce qui
//   décide de la lecture à la caméra.
// - EQR1 (jusqu'en 2026-09) : base64url en mode octet, QR très dense (77 à 85
//   modules sur ~22 mm, soit 0,25 mm par module : illisible par beaucoup de
//   téléphones). Plus jamais émis, toujours DÉCHIFFRÉ : des documents
//   imprimés dans ce format circulent.
const PREFIX = "EQR2.";
const PREFIX_V1 = "EQR1.";

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

// base64url : lecture des jetons EQR1 seulement.
function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// Base45 (RFC 9285) : 2 octets → 3 caractères, octet final isolé → 2.
const B45 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

export function b45Encode(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const n = bytes[i] * 256 + bytes[i + 1];
      out += B45[n % 45] + B45[Math.floor(n / 45) % 45] + B45[Math.floor(n / 2025)];
    } else {
      out += B45[bytes[i] % 45] + B45[Math.floor(bytes[i] / 45)];
    }
  }
  return out;
}

// Lève une erreur sur tout jeton invalide (caractère hors alphabet, longueur
// impossible, valeur hors plage) : le scanner le traite comme non reconnu.
export function b45Decode(str) {
  if (str.length % 3 === 1) throw new Error("base45 : longueur invalide");
  const out = [];
  for (let i = 0; i < str.length; i += 3) {
    const bloc = str.slice(i, i + 3);
    const v = [...bloc].map((c) => {
      const k = B45.indexOf(c);
      if (k < 0) throw new Error("base45 : caractère invalide");
      return k;
    });
    if (v.length === 3) {
      const n = v[0] + v[1] * 45 + v[2] * 2025;
      if (n > 0xffff) throw new Error("base45 : valeur hors plage");
      out.push(n >> 8, n & 0xff);
    } else {
      const n = v[0] + v[1] * 45;
      if (n > 0xff) throw new Error("base45 : valeur hors plage");
      out.push(n);
    }
  }
  return Uint8Array.from(out);
}

async function deriveKey(secret) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(`${PEPPER}|${secret || ""}`));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

// Chiffre un texte → jeton "EQR2.<base45(iv|ciphertext)>". En cas d'échec
// (Web Crypto indisponible…) on renvoie le texte tel quel pour ne pas perdre le QR.
export async function encryptQrPayload(text, secret) {
  try {
    const key = await deriveKey(secret);
    const clair = new TextEncoder().encode(String(text));
    // L'espace fait partie de l'alphabet base45 : un jeton qui FINIRAIT par
    // une espace serait corrompu par le moindre trim() d'un lecteur. On tire
    // alors un autre IV (1 cas sur 45, jeton aussi valide que les autres).
    for (;;) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, clair));
      const combined = new Uint8Array(iv.length + ct.length);
      combined.set(iv);
      combined.set(ct, iv.length);
      const jeton = PREFIX + b45Encode(combined);
      if (!jeton.endsWith(" ")) return jeton;
    }
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
  if (typeof token !== "string") return null;
  let iv;
  let ct;
  try {
    let combined;
    if (token.startsWith(PREFIX)) combined = b45Decode(token.slice(PREFIX.length));
    else if (token.startsWith(PREFIX_V1)) combined = b64urlDecode(token.slice(PREFIX_V1.length));
    else return null; // pas un QR EduGest chiffré
    iv = combined.slice(0, 12);
    ct = combined.slice(12);
  } catch {
    return null; // jeton tronqué / encodage invalide
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

// Clés COURTES des champs (depuis EQR2). Les appelants écrivent des clés
// lisibles (Eleve, Classe…), qrPayload les remplace par ces codes d'une
// lettre et le scanner les rétablit en libellés : chaque octet retiré
// allège le QR (cf. qr.js). Ne JAMAIS réaffecter un code existant : les
// documents imprimés le portent.
export const CLES_QR = {
  EduGest: "T", Eleve: "E", IEN: "I", Classe: "C", Periode: "P", Moy: "M",
  Annee: "A", Num: "N", Du: "D", Au: "F", Total: "S", Mois: "O",
  Enseignant: "G", NetTotal: "X",
};
// Type de document (valeur du champ EduGest), abrégé de la même façon.
export const TYPES_QR = { Bulletin: "B", Recu: "R", Attestation: "A", "Fiche de paie": "P" };

const LIBELLE_TYPE = { B: "Bulletin", R: "Reçu", A: "Attestation", P: "Fiche de paie", Recu: "Reçu" };
// Libellés affichés, pour les clés courtes (EQR2) ET les anciennes clés
// longues (EQR1, documents déjà imprimés).
const LIBELLE_CHAMP = {
  E: "Élève", I: "IEN", C: "Classe", P: "Période", M: "Moyenne", A: "Année",
  N: "N°", D: "Du", F: "Au", S: "Total payé", O: "Mois", G: "Enseignant", X: "Net total",
  Ecole: "École", Eleve: "Élève", Periode: "Période", Moy: "Moyenne", Annee: "Année",
  Num: "N°", Total: "Total payé", NetTotal: "Net total",
};

// Charge utile déchiffrée → { type, champs: [[libellé, valeur], …] } pour
// l'affichage du scanner, quel que soit le format (EQR1 ou EQR2).
export function lireChampsQr(texte = "") {
  const brut = parseQrPayload(texte);
  const typeBrut = brut.T ?? brut.EduGest;
  return {
    type: LIBELLE_TYPE[typeBrut] || typeBrut || "Document",
    champs: Object.entries(brut)
      .filter(([k]) => k !== "T" && k !== "EduGest")
      .map(([k, v]) => [LIBELLE_CHAMP[k] || k, v]),
  };
}
