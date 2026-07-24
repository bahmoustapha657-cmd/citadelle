import { test } from "node:test";
import assert from "node:assert/strict";
import { estPremiumActif, FONCTIONS_PREMIUM, PLANS_PREMIUM } from "../shared/plan-features.js";

const JOUR = 86400000;
const MAINTENANT = 1_800_000_000_000;

test("seuls les plans premium ouvrent les fonctions payantes", () => {
  for (const plan of ["gratuit", "starter", "standard"]) {
    assert.equal(estPremiumActif({ plan, planExpiry: null, now: MAINTENANT }), false, plan);
  }
  assert.equal(estPremiumActif({ plan: "premium", planExpiry: null, now: MAINTENANT }), true);
});

test("premium non échu = actif", () => {
  assert.equal(estPremiumActif({ plan: "premium", planExpiry: MAINTENANT + 10 * JOUR, now: MAINTENANT }), true);
});

test("premium échu reste actif pendant la période de grâce (3 j)", () => {
  // expiré depuis 2 jours → encore dans la grâce
  assert.equal(estPremiumActif({ plan: "premium", planExpiry: MAINTENANT - 2 * JOUR, now: MAINTENANT }), true);
  // expiré depuis 4 jours → coupé
  assert.equal(estPremiumActif({ plan: "premium", planExpiry: MAINTENANT - 4 * JOUR, now: MAINTENANT }), false);
});

test("entrées absentes ou inconnues = pas premium", () => {
  assert.equal(estPremiumActif(), false);
  assert.equal(estPremiumActif({}), false);
  assert.equal(estPremiumActif({ plan: null }), false);
  assert.equal(estPremiumActif({ plan: "inconnu" }), false);
});

test("le catalogue premium couvre les deux fonctions facturées", () => {
  assert.deepEqual(Object.keys(FONCTIONS_PREMIUM).sort(), ["appreciations_ia", "notifications"]);
  assert.ok(PLANS_PREMIUM.includes("premium"));
});
