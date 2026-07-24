// Chiffrement des QR codes : roundtrip + isolation par secret (école).
import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptQrPayload, decryptQrPayload, parseQrPayload, schoolSecret, schoolSecretCandidates,
} from "../src/reports/qr-crypto.js";

test("encrypt → decrypt restitue le texte (même secret)", async () => {
  const secret = schoolSecret({ id: "ecole-123" });
  const clair = "EduGest:Bulletin|Eleve:Diallo A|Moy:16/20";
  const token = await encryptQrPayload(clair, secret);
  assert.ok(token.startsWith("EQR1."), "jeton préfixé EQR1.");
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
