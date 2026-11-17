// ── Chiffrage des sauvegardes envoyées hors du PC ───────────────────────────
// Les copies rangées dans Google Drive sont chiffrées avant de quitter la
// machine qui les fait : sans une CLÉ PRIVÉE, ni Google, ni quiconque entre
// dans le compte, ni GitHub ne peut les lire.
//
// Chiffrement à clé publique : la machine qui sauvegarde n'a que les clés
// PUBLIQUES (supabase/cles-sauvegarde.txt, sans danger). Chaque détenteur
// (titulaire, suppléant…) ouvre les copies avec SA clé privée, qui ne
// quitte jamais ses mains.
//
// Briques standard de node:crypto, aucune dépendance :
//   • X25519 (échange de clés, comme le format age), une clé éphémère par
//     destinataire et par fichier ;
//   • HKDF-SHA256 pour dériver la clé d'enveloppe ;
//   • AES-256-GCM pour la clé de données et pour le contenu (toute
//     altération est détectée, en-tête compris).
//
// Format d'un fichier chiffré (version 1), octet par octet :
//   "EDUGEST-CHIFFRE-1\n"                         en-tête lisible
//   n (1 octet)                                   nombre de destinataires
//   n × [ éphémère 32 | nonce 12 | clé 32 | tag 16 ]   clé de données enveloppée
//   nonce 12                                      nonce du contenu
//   contenu chiffré | tag 16                      AES-256-GCM, AAD = tout ce qui précède
import {
  createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey,
  diffieHellman, generateKeyPairSync, hkdfSync, randomBytes,
} from "node:crypto";

export const MAGIQUE = Buffer.from("EDUGEST-CHIFFRE-1\n", "ascii");
const INFO = Buffer.from("edugest-sauvegarde-v1 enveloppe", "ascii");
const TAILLE_BLOC = 32 + 12 + 32 + 16;

// Clés X25519 brutes (32 octets) ⇄ objets KeyObject de node:crypto.
const PKCS8 = Buffer.from("302e020100300506032b656e04220420", "hex");
const SPKI = Buffer.from("302a300506032b656e032100", "hex");
const objetPrive = (brut) => createPrivateKey({ key: Buffer.concat([PKCS8, brut]), format: "der", type: "pkcs8" });
const objetPublic = (brut) => createPublicKey({ key: Buffer.concat([SPKI, brut]), format: "der", type: "spki" });
const brutDePublic = (objet) => objet.export({ format: "der", type: "spki" }).subarray(SPKI.length);
const brutDePrive = (objet) => objet.export({ format: "der", type: "pkcs8" }).subarray(PKCS8.length);

// ── Écriture des clés ─────────────────────────────────────────────────────
// En hexadécimal (pas de confusion l/1, O/0 en recopiant à la main) ; la clé
// privée porte une somme de contrôle qui repère une faute de frappe.
const PREFIXE_PRIVEE = "EDUGEST-PRIVEE-";
const PREFIXE_PUBLIQUE = "edugest-publique-";
const controle = (hex) => createHash("sha256").update(PREFIXE_PRIVEE + hex).digest("hex").slice(0, 4);

export function genererCles() {
  const { publicKey, privateKey } = generateKeyPairSync("x25519");
  return { privee: brutDePrive(privateKey), publique: brutDePublic(publicKey) };
}

export const ecrirePrivee = (brut) => {
  const hex = Buffer.from(brut).toString("hex");
  return `${PREFIXE_PRIVEE}${hex}-${controle(hex)}`;
};
export const ecrirePublique = (brut) => `${PREFIXE_PUBLIQUE}${Buffer.from(brut).toString("hex")}`;

// La même clé privée, disposée pour être recopiée sur papier : 8 groupes de 8
// caractères sur deux lignes. lirePrivee la relit telle quelle.
export function priveeParGroupes(brut) {
  const [, hex, ctrl] = /^EDUGEST-PRIVEE-([0-9a-f]{64})-([0-9a-f]{4})$/.exec(ecrirePrivee(brut));
  const groupes = hex.toUpperCase().match(/.{8}/g);
  return `${PREFIXE_PRIVEE}\n${groupes.slice(0, 4).join(" ")}\n${groupes.slice(4).join(" ")}\n-${ctrl.toUpperCase()}`;
}

// Tolère espaces, retours à la ligne, majuscules/minuscules (clé recopiée
// depuis le papier, par groupes) et lignes de commentaire (#).
export function lirePrivee(texte) {
  const t = String(texte || "").replace(/#.*$/gm, "").replace(/\s+/g, "").toUpperCase();
  const m = /^EDUGEST-PRIVEE-([0-9A-F]{64})-([0-9A-F]{4})$/.exec(t);
  if (!m) throw new Error("clé privée illisible : attendu EDUGEST-PRIVEE-<64 caractères>-<4 caractères>");
  const hex = m[1].toLowerCase();
  if (controle(hex) !== m[2].toLowerCase()) throw new Error("clé privée erronée : faute de recopie (somme de contrôle fausse)");
  return Buffer.from(hex, "hex");
}

export function lirePublique(texte) {
  const m = /^edugest-publique-([0-9a-f]{64})$/i.exec(String(texte || "").trim());
  if (!m) throw new Error("clé publique illisible : attendu edugest-publique-<64 caractères>");
  return Buffer.from(m[1].toLowerCase(), "hex");
}

export const publiqueDe = (privee) => brutDePublic(createPublicKey(objetPrive(Buffer.from(privee))));

// Fichier des clés publiques : une clé par ligne (suivie d'un libellé),
// lignes vides et commentaires (#) ignorés.
export function lireFichierCles(texte) {
  const cles = String(texte || "").split(/\r?\n/)
    .map((l) => l.replace(/#.*/, "").trim()).filter(Boolean)
    .map((l) => lirePublique(l.split(/\s+/)[0]));
  if (!cles.length) throw new Error("aucune clé publique : impossible de chiffrer");
  return cles;
}

// ── Chiffrer / déchiffrer ─────────────────────────────────────────────────
const cleEnveloppe = (partage, ephemere, destinataire) =>
  Buffer.from(hkdfSync("sha256", partage, Buffer.concat([ephemere, destinataire]), INFO, 32));

export function chiffrer(donnees, clesPubliques) {
  if (!clesPubliques?.length) throw new Error("aucun destinataire");
  if (clesPubliques.length > 255) throw new Error("trop de destinataires");
  const cleDonnees = randomBytes(32);
  const blocs = clesPubliques.map((destinataire) => {
    const { publicKey, privateKey } = generateKeyPairSync("x25519");
    const ephemere = brutDePublic(publicKey);
    const partage = diffieHellman({ privateKey, publicKey: objetPublic(Buffer.from(destinataire)) });
    const nonce = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", cleEnveloppe(partage, ephemere, destinataire), nonce);
    const enveloppee = Buffer.concat([c.update(cleDonnees), c.final()]);
    return Buffer.concat([ephemere, nonce, enveloppee, c.getAuthTag()]);
  });
  const nonce = randomBytes(12);
  const entete = Buffer.concat([MAGIQUE, Buffer.from([blocs.length]), ...blocs, nonce]);
  const c = createCipheriv("aes-256-gcm", cleDonnees, nonce);
  c.setAAD(entete);
  return Buffer.concat([entete, c.update(donnees), c.final(), c.getAuthTag()]);
}

export function dechiffrer(chiffre, clePrivee) {
  const b = Buffer.from(chiffre);
  if (b.length < MAGIQUE.length + 1 || !b.subarray(0, MAGIQUE.length).equals(MAGIQUE)) {
    throw new Error("ce fichier n'est pas une sauvegarde chiffrée par EduGest");
  }
  const n = b[MAGIQUE.length];
  const debutNonce = MAGIQUE.length + 1 + n * TAILLE_BLOC;
  if (b.length < debutNonce + 12 + 16) throw new Error("fichier chiffré tronqué");
  const prive = objetPrive(Buffer.from(clePrivee));
  const moi = brutDePublic(createPublicKey(prive));
  let cleDonnees = null;
  for (let i = 0, pos = MAGIQUE.length + 1; i < n && !cleDonnees; i += 1, pos += TAILLE_BLOC) {
    const ephemere = b.subarray(pos, pos + 32);
    const partage = diffieHellman({ privateKey: prive, publicKey: objetPublic(ephemere) });
    const d = createDecipheriv("aes-256-gcm", cleEnveloppe(partage, ephemere, moi), b.subarray(pos + 32, pos + 44));
    d.setAuthTag(b.subarray(pos + 76, pos + 92));
    try {
      cleDonnees = Buffer.concat([d.update(b.subarray(pos + 44, pos + 76)), d.final()]);
    } catch { /* bloc d'un autre destinataire */ }
  }
  if (!cleDonnees) throw new Error("cette clé privée ne peut pas ouvrir ce fichier");
  const entete = b.subarray(0, debutNonce + 12);
  const d = createDecipheriv("aes-256-gcm", cleDonnees, b.subarray(debutNonce, debutNonce + 12));
  d.setAAD(entete);
  d.setAuthTag(b.subarray(b.length - 16));
  try {
    return Buffer.concat([d.update(b.subarray(debutNonce + 12, b.length - 16)), d.final()]);
  } catch {
    throw new Error("fichier chiffré altéré ou abîmé (contrôle d'intégrité en échec)");
  }
}
