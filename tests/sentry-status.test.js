import test from "node:test";
import assert from "node:assert/strict";

import { getSentryConfig } from "../api/_lib/handlers/sentry-status.js";

test("getSentryConfig retourne ok:false quand toutes les vars manquent", () => {
  const cfg = getSentryConfig({});
  assert.equal(cfg.ok, false);
  assert.match(cfg.error, /SENTRY_AUTH_TOKEN/);
});

test("getSentryConfig retourne ok:false si un seul champ manque", () => {
  const cfg = getSentryConfig({ SENTRY_AUTH_TOKEN: "t", SENTRY_ORG_SLUG: "o" });
  assert.equal(cfg.ok, false);
});

test("getSentryConfig retourne ok:true quand les 3 vars sont presentes", () => {
  const cfg = getSentryConfig({
    SENTRY_AUTH_TOKEN: "tok",
    SENTRY_ORG_SLUG: "edugest",
    SENTRY_PROJECT_SLUG: "citadelle",
  });
  assert.equal(cfg.ok, true);
  assert.equal(cfg.org, "edugest");
  assert.equal(cfg.project, "citadelle");
  assert.equal(cfg.token, "tok");
});
