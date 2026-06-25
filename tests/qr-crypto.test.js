// Chiffrement des QR codes : roundtrip + isolation par secret (école).
import test from "node:test";
import assert from "node:assert/strict";
import { encryptQrPayload, decryptQrPayload, parseQrPayload, schoolSecret } from "../src/reports/qr-crypto.js";

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

test("parseQrPayload : reconstruit l'objet", () => {
  assert.deepEqual(
    parseQrPayload("EduGest:Bulletin|Moy:16/20"),
    { EduGest: "Bulletin", Moy: "16/20" },
  );
});
