import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHOOL_LIFECYCLE_CONFIRMATIONS,
  buildSchoolLifecyclePatch,
  normalizeSchoolLifecycleAction,
} from "../api/_lib/handlers/school-lifecycle.js";

test("normalizeSchoolLifecycleAction only accepts supported actions", () => {
  assert.equal(normalizeSchoolLifecycleAction(" deactivate "), "deactivate");
  assert.equal(normalizeSchoolLifecycleAction("DELETE"), "delete");
  assert.equal(normalizeSchoolLifecycleAction("reactivate"), "reactivate");
  assert.equal(normalizeSchoolLifecycleAction("unknown"), "");
});

test("SCHOOL_LIFECYCLE_CONFIRMATIONS exposes the required confirmations", () => {
  assert.deepEqual(SCHOOL_LIFECYCLE_CONFIRMATIONS, {
    deactivate: "DESACTIVER",
    delete: "SUPPRIMER",
    reactivate: "ACTIVER",
  });
});

test("buildSchoolLifecyclePatch marks a school inactive", () => {
  const patch = buildSchoolLifecyclePatch("deactivate", {
    uid: "u1",
    profile: { role: "direction" },
  }, 123);

  assert.equal(patch.actif, false);
  assert.equal(patch.supprime, false);
  assert.equal(patch.deactivatedAt, 123);
  assert.deepEqual(patch.deactivatedBy, {
    uid: "u1",
    role: "direction",
    at: 123,
  });
});

test("buildSchoolLifecyclePatch marks a school deleted", () => {
  const patch = buildSchoolLifecyclePatch("delete", {
    uid: "u2",
    profile: { role: "direction" },
  }, 456);

  assert.equal(patch.actif, false);
  assert.equal(patch.supprime, true);
  assert.equal(patch.deletedAt, 456);
  assert.deepEqual(patch.deletedBy, {
    uid: "u2",
    role: "direction",
    at: 456,
  });
});

test("buildSchoolLifecyclePatch can reactivate a school", () => {
  const patch = buildSchoolLifecyclePatch("reactivate", {
    uid: "u3",
    profile: { role: "superadmin" },
  }, 789);

  assert.equal(patch.actif, true);
  assert.equal(patch.supprime, false);
  assert.equal(patch.reactivatedAt, 789);
  assert.deepEqual(patch.reactivatedBy, {
    uid: "u3",
    role: "superadmin",
    at: 789,
  });
});
