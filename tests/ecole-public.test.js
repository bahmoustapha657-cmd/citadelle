import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ECOLE_PUBLIC_FIELDS,
  buildEcolePublicPayload,
  syncEcolePublic,
} from "../api/_lib/ecole-public.js";

test("buildEcolePublicPayload only keeps the approved public fields", () => {
  const source = {
    nom: "École Citadelle",
    ville: "Conakry",
    pays: "Guinée",
    logo: "data:image/png;base64,xxx",
    couleur1: "#123",
    couleur2: "#456",
    type: "privée",
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

test("syncEcolePublic overwrites stale public branding data", async () => {
  let receivedArgs = null;
  const db = {
    collection(name) {
      assert.equal(name, "ecoles_public");
      return {
        doc(id) {
          assert.equal(id, "la-citadelle");
          return {
            async set(...args) {
              receivedArgs = args;
            },
          };
        },
      };
    },
  };

  const result = await syncEcolePublic(db, "la-citadelle", {
    nom: "École Citadelle",
    ville: "Conakry",
    pays: "Guinée",
  });

  assert.deepEqual(result, { written: true });
  assert.equal(receivedArgs.length, 1);
  assert.equal(receivedArgs[0].nom, "École Citadelle");
  assert.equal(receivedArgs[0].ville, "Conakry");
  assert.equal(receivedArgs[0].pays, "Guinée");
  assert.ok("updatedAt" in receivedArgs[0]);
  assert.equal(receivedArgs[0].logo, undefined);
  assert.equal(receivedArgs[0].accueil, undefined);
});
