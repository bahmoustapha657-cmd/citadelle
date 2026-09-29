// Chiffrement des QR codes : roundtrip + isolation par secret (école).
import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptQrPayload, decryptQrPayload, parseQrPayload, schoolSecret, schoolSecretCandidates,
  b45Encode, b45Decode, lireChampsQr,
} from "../src/reports/qr-crypto.js";

test("encrypt → decrypt restitue le texte (même secret)", async () => {
  const secret = schoolSecret({ id: "ecole-123" });
  const clair = "EduGest:Bulletin|Eleve:Diallo A|Moy:16/20";
  const token = await encryptQrPayload(clair, secret);
  assert.ok(token.startsWith("EQR2."), "jeton préfixé EQR2.");
  assert.notEqual(token, clair, "le jeton n'est pas en clair");
  assert.equal(await decryptQrPayload(token, secret), clair);
});

test("un autre secret (autre école) ne déchiffre pas", async () => {
  const token = await encryptQrPayload("EduGest:Recu|Total:500000 GNF", schoolSecret({ id: "A" }));
  assert.equal(await decryptQrPayload(token, schoolSecret({ id: "B" })), null);
});

test("decrypt ignore ce qui n'est pas un jeton EduGest", async () => {
  assert.equal(await decryptQrPayload("https://example.com", "s"), null);
  assert.equal(await decryptQrPayload("", "s"), null);
});

// ── Format EQR2 (base45 → mode alphanumérique du QR) ────────────────────────

test("base45 : vecteurs de la RFC 9285 et aller-retour", () => {
  const enc = (s) => b45Encode(new TextEncoder().encode(s));
  assert.equal(enc("AB"), "BB8");
  assert.equal(enc("Hello!!"), "%69 VD92EX0");
  assert.equal(enc("base-45"), "UJCLQE7W581");
  const octets = Uint8Array.from({ length: 257 }, (_, i) => (i * 131) % 256);
  assert.deepEqual(b45Decode(b45Encode(octets)), octets);
});

test("base45 : un jeton invalide lève une erreur (jamais d'octets inventés)", () => {
  assert.throws(() => b45Decode("ab"), /caractère/); // minuscules hors alphabet
  assert.throws(() => b45Decode("BB8B"), /longueur/);
  assert.throws(() => b45Decode(":::"), /plage/); // 44+44·45+44·2025 > 0xFFFF
});

test("jeton EQR2 : alphabet alphanumérique du QR, jamais d'espace final", async () => {
  // Une espace finale serait perdue au moindre trim() d'un lecteur.
  for (let i = 0; i < 200; i += 1) {
    const token = await encryptQrPayload(`T:B|E:Élève ${i}`, "citadelle");
    assert.match(token, /^EQR2\.[0-9A-Z $%*+\-./:]+$/);
    assert.ok(!token.endsWith(" "), token);
  }
});

test("decryptQrPayload : un jeton EQR2 tronqué ou altéré est refusé", async () => {
  const token = await encryptQrPayload("T:R|S:500000 GNF", "s");
  assert.equal(await decryptQrPayload("EQR2.", ["s"]), null);
  assert.equal(await decryptQrPayload(token.slice(0, -3), ["s"]), null);
  assert.equal(await decryptQrPayload(token.toLowerCase(), ["s"]), null);
  const altere = token.slice(0, 20) + (token[20] === "0" ? "1" : "0") + token.slice(21);
  assert.equal(await decryptQrPayload(altere, ["s"]), null);
});

// Jeton réellement émis par le format EQR1 (base64url) avant 2026-09 : des
// documents imprimés le portent, le scanner doit toujours le lire.
const JETON_EQR1 = "EQR1.5Eh_0anmyjcG7qc-GRVVbmh_3mMKoTEG7MlADaMdIxM4TFwG8QpaB3pcIuqjbNuJrlIkTF3nob1mmDl9USGzUP8cjX3vvxJrqD73gv6HonVKvBs1ENEnzPMuFQsgFXX_KHNrZFroZWfExbRy1U3RrneufvMhB4vclqzON6lmAopqhx_w5VM";

test("un document imprimé au format EQR1 reste lisible", async () => {
  assert.equal(
    await decryptQrPayload(JETON_EQR1, schoolSecretCandidates({ code: "citadelle", nom: "La Citadelle" })),
    "EduGest:Bulletin|Ecole:Groupe Scolaire La Citadelle|Eleve:DIALLO Aliou|Classe:10ème Année A|Moy:12.45/20",
  );
  assert.equal(await decryptQrPayload(JETON_EQR1, ["demo"]), null);
});

test("lireChampsQr : clés courtes EQR2 → libellés", () => {
  assert.deepEqual(lireChampsQr("T:B|E:Diallo A|I:GN123|M:16/20|A:2025-2026"), {
    type: "Bulletin",
    champs: [["Élève", "Diallo A"], ["IEN", "GN123"], ["Moyenne", "16/20"], ["Année", "2025-2026"]],
  });
  assert.equal(lireChampsQr("T:R|S:500000 GNF").type, "Reçu");
  assert.equal(lireChampsQr("T:P|X:900000 GNF").type, "Fiche de paie");
});

test("lireChampsQr : anciennes clés longues EQR1 → mêmes libellés", () => {
  assert.deepEqual(lireChampsQr("EduGest:Recu|Ecole:La Citadelle|Eleve:Bah M|Total:500000 GNF"), {
    type: "Reçu",
    champs: [["École", "La Citadelle"], ["Élève", "Bah M"], ["Total payé", "500000 GNF"]],
  });
  assert.equal(lireChampsQr("Moy:16/20").type, "Document");
});

test("schoolSecret : stable et discriminant", () => {
  assert.equal(schoolSecret({ id: "x" }), schoolSecret({ id: "x" }));
  assert.notEqual(schoolSecret({ id: "x" }), schoolSecret({ id: "y" }));
});

// ── Secret stable : le code école prime, le nom n'est plus qu'un repli ──────

test("schoolSecret : privilégie le code école (immuable) sur le nom", () => {
  assert.equal(schoolSecret({ code: "citadelle", nom: "Groupe Scolaire La Citadelle" }), "citadelle");
  assert.equal(schoolSecret({ nom: "École Démo" }), "École Démo"); // sans code : repli historique
  assert.equal(schoolSecret({}), "edugest");
});

test("schoolSecretCandidates : ordre du plus stable au moins stable, sans doublon", () => {
  assert.deepEqual(
    schoolSecretCandidates({ code: "demo", id: "uuid-1", schoolId: "demo", nom: "École Démo" }),
    ["demo", "uuid-1", "École Démo", "edugest"], // schoolId dédoublonné avec code
  );
  assert.deepEqual(schoolSecretCandidates({ nom: "X" }), ["X", "edugest"]);
  assert.equal(schoolSecretCandidates({ code: "demo" })[0], schoolSecret({ code: "demo" }));
});

test("schoolSecretCandidates : ne normalise pas (octet près, sinon QR imprimés illisibles)", () => {
  assert.deepEqual(schoolSecretCandidates({ nom: " École " }), [" École ", "edugest"]);
});

// ── Rétro-compatibilité : les QR déjà imprimés restent lisibles ─────────────

test("QR imprimé AVANT l'exposition du code (secret = nom) reste lisible", async () => {
  // À l'époque, schoolInfo ne portait que le nom → secret = nom.
  const ancien = { nom: "Groupe Scolaire La Citadelle" };
  const token = await encryptQrPayload("EduGest:Bulletin|Eleve:Diallo A", schoolSecret(ancien));
  // Aujourd'hui, le même schoolInfo porte le code → le nom n'est plus le secret
  // principal, mais reste un candidat au déchiffrement.
  const aujourdhui = { code: "citadelle", nom: "Groupe Scolaire La Citadelle" };
  assert.equal(schoolSecret(aujourdhui), "citadelle");
  assert.equal(
    await decryptQrPayload(token, schoolSecretCandidates(aujourdhui)),
    "EduGest:Bulletin|Eleve:Diallo A",
  );
});

test("bout en bout : un QR imprimé survit au RENOMMAGE de l'école", async () => {
  const avant = { code: "citadelle", nom: "Groupe scolaire la citadelle" };
  const apres = { code: "citadelle", nom: "Groupe Scolaire La Citadelle" }; // accents/casse corrigés
  const clair = "EduGest:Recu|Eleve:Bah M|Total:500000 GNF";
  const token = await encryptQrPayload(clair, schoolSecret(avant));
  assert.equal(await decryptQrPayload(token, schoolSecretCandidates(apres)), clair);
});

test("QR imprimé du temps de Firebase (secret = id du document) reste lisible", async () => {
  const token = await encryptQrPayload("EduGest:Paie|Net:1200000", schoolSecret({ id: "citadelle" }));
  const apres = { code: "citadelle", nom: "Nom tout à fait différent" };
  assert.equal(await decryptQrPayload(token, schoolSecretCandidates(apres)), "EduGest:Paie|Net:1200000");
});

// ── L'isolation entre écoles reste garantie malgré la liste de candidats ────

test("une autre école ne déchiffre pas, même en essayant tous ses candidats", async () => {
  const token = await encryptQrPayload("EduGest:Bulletin|Moy:16/20", schoolSecret({ code: "citadelle", nom: "La Citadelle" }));
  assert.equal(await decryptQrPayload(token, schoolSecretCandidates({ code: "demo", nom: "École Démo" })), null);
});

test("decryptQrPayload : accepte encore un secret unique (chaîne)", async () => {
  const token = await encryptQrPayload("EduGest:Bulletin", "s");
  assert.equal(await decryptQrPayload(token, "s"), "EduGest:Bulletin");
  assert.equal(await decryptQrPayload(token, "autre"), null);
  assert.equal(await decryptQrPayload(token, []), null); // aucun candidat → refus
});

test("decryptQrPayload : un jeton EQR1 tronqué ne fait pas exploser le scanner", async () => {
  assert.equal(await decryptQrPayload("EQR1.", ["s"]), null);
  assert.equal(await decryptQrPayload("EQR1.!!!pas-du-base64!!!", ["s"]), null);
});

test("parseQrPayload : reconstruit l'objet", () => {
  assert.deepEqual(
    parseQrPayload("EduGest:Bulletin|Moy:16/20"),
    { EduGest: "Bulletin", Moy: "16/20" },
  );
});
