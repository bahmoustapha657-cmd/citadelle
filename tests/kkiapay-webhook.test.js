import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import {
  buildKkiapaySignature,
  getMinimumProPaymentAmount,
  isEligibleProPayment,
  normalizePaymentAmount,
  signaturesMatch,
  verifyKkiapaySignature,
} from "../api/kkiapay-webhook.js";

test("buildKkiapaySignature and verifyKkiapaySignature agree on valid payloads", () => {
  const payload = {
    transaction_id: "txn-123",
    status: "SUCCESS",
    amount: 500000,
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

test("payment helpers normalize amounts and enforce a minimum", () => {
  assert.equal(normalizePaymentAmount("500000"), 500000);
  assert.equal(normalizePaymentAmount("bad"), 0);
  assert.equal(isEligibleProPayment("SUCCESS", 500000, 500000), true);
  assert.equal(isEligibleProPayment("SUCCESS", 499999, 500000), false);
  assert.equal(isEligibleProPayment("FAILED", 900000, 500000), false);
});

test("getMinimumProPaymentAmount uses a safe default", () => {
  const previous = process.env.KKIAPAY_PRO_MIN_AMOUNT;
  delete process.env.KKIAPAY_PRO_MIN_AMOUNT;

  try {
    assert.equal(getMinimumProPaymentAmount(), 500000);
  } finally {
    if (previous === undefined) {
      delete process.env.KKIAPAY_PRO_MIN_AMOUNT;
    } else {
      process.env.KKIAPAY_PRO_MIN_AMOUNT = previous;
    }
  }
});
