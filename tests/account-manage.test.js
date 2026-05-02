import test from "node:test";
import assert from "node:assert/strict";

import { canManageTargetRole } from "../api/_lib/handlers/account-manage.js";

test("primaire peut creer un compte enseignant du primaire", () => {
  const allowed = canManageTargetRole(
    { profile: { role: "primaire" } },
    "enseignant",
    { section: "primaire" },
  );

  assert.equal(allowed, true);
});

test("primaire ne peut pas creer un compte enseignant du secondaire", () => {
  const allowed = canManageTargetRole(
    { profile: { role: "primaire" } },
    "enseignant",
    { section: "college" },
  );

  assert.equal(allowed, false);
});

test("college peut creer un compte enseignant college ou lycee", () => {
  assert.equal(
    canManageTargetRole(
      { profile: { role: "college" } },
      "enseignant",
      { section: "college" },
    ),
    true,
  );

  assert.equal(
    canManageTargetRole(
      { profile: { role: "college" } },
      "enseignant",
      { section: "lycee" },
    ),
    true,
  );
});

test("college ne peut pas creer un compte parent", () => {
  const allowed = canManageTargetRole(
    { profile: { role: "college" } },
    "parent",
    { section: "college" },
  );

  assert.equal(allowed, false);
});
