import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveTransferCollection,
  validateTransferAcceptance,
  validateTransferReadState,
} from "../api/transfert.js";

test("resolveTransferCollection maps sections to the right destination collections", () => {
  assert.equal(resolveTransferCollection("primaire"), "elevesPrimaire");
  assert.equal(resolveTransferCollection("lycee"), "elevesLycee");
  assert.equal(resolveTransferCollection("college"), "elevesCollege");
  assert.equal(resolveTransferCollection("unknown"), "elevesCollege");
});

test("validateTransferReadState blocks used tokens", () => {
  assert.deepEqual(
    validateTransferReadState({ statut: "acceptÃ©", dateExpiration: Date.now() + 1_000 }),
    {
      ok: false,
      status: 410,
      error: "Ce token a dÃ©jÃ  Ã©tÃ© utilisÃ©",
    },
  );
});

test("validateTransferReadState flags expired transfers for cleanup", () => {
  assert.deepEqual(
    validateTransferReadState({ statut: "en_attente", dateExpiration: 10 }, 20),
    {
      ok: false,
      status: 410,
      error: "Ce token a expirÃ© (validitÃ© 30 jours)",
      shouldExpire: true,
    },
  );
});

test("validateTransferAcceptance rejects reused, expired, or same-school transfers", () => {
  assert.deepEqual(
    validateTransferAcceptance({ statut: "acceptÃ©", dateExpiration: Date.now() + 10_000 }, "ecole-b"),
    {
      ok: false,
      status: 409,
      error: "Token dÃ©jÃ  utilisÃ© ou expirÃ©",
    },
  );

  assert.deepEqual(
    validateTransferAcceptance({ statut: "en_attente", dateExpiration: 10 }, "ecole-b", 20),
    {
      ok: false,
      status: 410,
      error: "Token expirÃ©",
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
      error: "Le transfert vers la mÃªme Ã©cole est interdit.",
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
