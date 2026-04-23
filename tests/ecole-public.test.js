import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ECOLE_PUBLIC_FIELDS,
  buildEcolePublicPayload,
  shouldExposeEcolePublic,
  syncEcolePublic,
} from "../api/_lib/ecole-public.js";

test("buildEcolePublicPayload only keeps the approved public fields", () => {
  const source = {
    nom: "Ecole Citadelle",
    ville: "Conakry",
    pays: "Guinee",
    logo: "data:image/png;base64,xxx",
    couleur1: "#123",
    couleur2: "#456",
    type: "privee",
    accueil: { active: true },
    plan: "pro",
    planExpiry: 1700000000000,
    lastSuccessfulPaymentId: "kkiapay_abc",
    verrous: { paiements: true },
    blocageParentImpaye: true,
    securityVersion: 2,
    actif: true,
  };

  const payload = buildEcolePublicPayload(source);

  for (const key of ECOLE_PUBLIC_FIELDS) {
    assert.equal(payload[key], source[key]);
  }
  assert.equal(payload.plan, undefined);
  assert.equal(payload.planExpiry, undefined);
  assert.equal(payload.lastSuccessfulPaymentId, undefined);
  assert.equal(payload.verrous, undefined);
  assert.equal(payload.blocageParentImpaye, undefined);
  assert.equal(payload.securityVersion, undefined);
  assert.equal(payload.actif, undefined);
});

test("buildEcolePublicPayload ignores undefined fields", () => {
  const payload = buildEcolePublicPayload({ nom: "A", ville: undefined });
  assert.deepEqual(payload, { nom: "A" });
});

test("shouldExposeEcolePublic hides inactive or deleted schools", () => {
  assert.equal(shouldExposeEcolePublic({ actif: true, supprime: false }), true);
  assert.equal(shouldExposeEcolePublic({ actif: false }), false);
  assert.equal(shouldExposeEcolePublic({ supprime: true }), false);
});

test("syncEcolePublic overwrites stale public branding data", async () => {
  let receivedArgs = null;
  const db = {
    collection(name) {
      assert.equal(name, "ecoles_public");
      return {
        doc(id) {
          assert.equal(id, "la-citadelle");
          return {
            async delete() {
              throw new Error("delete should not be called");
            },
            async set(...args) {
              receivedArgs = args;
            },
          };
        },
      };
    },
  };

  const result = await syncEcolePublic(db, "la-citadelle", {
    nom: "Ecole Citadelle",
    ville: "Conakry",
    pays: "Guinee",
  });

  assert.deepEqual(result, { written: true, deleted: false });
  assert.equal(receivedArgs.length, 1);
  assert.equal(receivedArgs[0].nom, "Ecole Citadelle");
  assert.equal(receivedArgs[0].ville, "Conakry");
  assert.equal(receivedArgs[0].pays, "Guinee");
  assert.ok("updatedAt" in receivedArgs[0]);
  assert.equal(receivedArgs[0].logo, undefined);
  assert.equal(receivedArgs[0].accueil, undefined);
});

test("syncEcolePublic removes the public projection for inactive schools", async () => {
  let deleted = false;
  const db = {
    collection(name) {
      assert.equal(name, "ecoles_public");
      return {
        doc(id) {
          assert.equal(id, "la-citadelle");
          return {
            async delete() {
              deleted = true;
            },
            async set() {
              throw new Error("set should not be called");
            },
          };
        },
      };
    },
  };

  const result = await syncEcolePublic(db, "la-citadelle", {
    nom: "Ecole Citadelle",
    actif: false,
  });

  assert.deepEqual(result, { written: false, deleted: true });
  assert.equal(deleted, true);
});
