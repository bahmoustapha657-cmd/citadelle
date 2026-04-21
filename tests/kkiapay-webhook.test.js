import assert from "node:assert/strict";
import test from "node:test";
import {
  buildKkiapaySignature,
  signaturesMatch,
  verifyKkiapaySignature,
} from "../api/kkiapay-webhook.js";

test("buildKkiapaySignature and verifyKkiapaySignature agree on valid payloads", () => {
  const payload = {
    transaction_id: "txn-123",
    status: "SUCCESS",
    amount: 150000,
    data: "ecole-kindia",
  };
  const privateKey = "secret-kkiapay";
  const signature = buildKkiapaySignature(payload, privateKey);

  assert.equal(verifyKkiapaySignature(payload, signature, privateKey), true);
});

test("verifyKkiapaySignature rejects malformed or forged signatures", () => {
  const payload = { transaction_id: "txn-123", status: "SUCCESS" };
  const signature = buildKkiapaySignature(payload, "secret-kkiapay");

  assert.equal(verifyKkiapaySignature(payload, signature, "wrong-secret"), false);
  assert.equal(verifyKkiapaySignature(payload, "not-hex", "secret-kkiapay"), false);
  assert.equal(verifyKkiapaySignature(payload, "", "secret-kkiapay"), false);
});

test("signaturesMatch protects against unequal digests", () => {
  const payload = { transaction_id: "txn-123", status: "SUCCESS" };
  const signature = buildKkiapaySignature(payload, "secret-kkiapay");
  const other = buildKkiapaySignature(payload, "another-secret");

  assert.equal(signaturesMatch(signature, signature), true);
  assert.equal(signaturesMatch(signature, other), false);
  assert.equal(signaturesMatch(signature, "abcd"), false);
});
