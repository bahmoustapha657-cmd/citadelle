import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTransferStatus,
  resolveTransferCollection,
  validateTransferAcceptance,
  validateTransferReadState,
} from "../api/transfert.js";

test("normalizeTransferStatus accepts legacy accented and mojibake values", () => {
  assert.equal(normalizeTransferStatus("accept\u00e9"), "accepted");
  assert.equal(normalizeTransferStatus("accept\u00c3\u00a9"), "accepted");
  assert.equal(normalizeTransferStatus("expir\u00e9"), "expired");
  assert.equal(normalizeTransferStatus("expired"), "expired");
  assert.equal(normalizeTransferStatus("en_attente"), "en_attente");
});

test("resolveTransferCollection maps sections to the right destination collections", () => {
  assert.equal(resolveTransferCollection("primaire"), "elevesPrimaire");
  assert.equal(resolveTransferCollection("lycee"), "elevesLycee");
  assert.equal(resolveTransferCollection("college"), "elevesCollege");
  assert.equal(resolveTransferCollection("unknown"), "elevesCollege");
});

test("validateTransferReadState blocks used tokens", () => {
  assert.deepEqual(
    validateTransferReadState({ statut: "accept\u00e9", dateExpiration: Date.now() + 1_000 }),
    {
      ok: false,
      status: 410,
      error: "Ce token a deja ete utilise.",
    },
  );
});

test("validateTransferReadState flags expired transfers for cleanup", () => {
  assert.deepEqual(
    validateTransferReadState({ statut: "en_attente", dateExpiration: 10 }, 20),
    {
      ok: false,
      status: 410,
      error: "Ce token a expire (validite 30 jours).",
      shouldExpire: true,
    },
  );
});

test("validateTransferAcceptance rejects reused, expired, or same-school transfers", () => {
  assert.deepEqual(
    validateTransferAcceptance({ statut: "accepted", dateExpiration: Date.now() + 10_000 }, "ecole-b"),
    {
      ok: false,
      status: 409,
      error: "Token deja utilise ou expire.",
    },
  );

  assert.deepEqual(
    validateTransferAcceptance({ statut: "en_attente", dateExpiration: 10 }, "ecole-b", 20),
    {
      ok: false,
      status: 410,
      error: "Token expire.",
      shouldExpire: true,
    },
  );

  assert.deepEqual(
    validateTransferAcceptance(
      { statut: "en_attente", dateExpiration: Date.now() + 10_000, schoolIdSource: "ecole-b" },
      "ecole-b",
    ),
    {
      ok: false,
      status: 409,
      error: "Le transfert vers la meme ecole est interdit.",
    },
  );
});

test("validateTransferAcceptance returns the target collection for valid transfers", () => {
  assert.deepEqual(
    validateTransferAcceptance(
      {
        statut: "en_attente",
        dateExpiration: Date.now() + 10_000,
        schoolIdSource: "ecole-a",
        eleveSnapshot: { section: "lycee" },
      },
      "ecole-b",
    ),
    {
      ok: true,
      collCible: "elevesLycee",
    },
  );
});
