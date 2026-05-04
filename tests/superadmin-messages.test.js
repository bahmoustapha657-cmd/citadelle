import test from "node:test";
import assert from "node:assert/strict";

import { isMessageVisibleToSchool } from "../api/_lib/handlers/superadmin-messages.js";

test("un message cible a l'ecole et au role est visible", () => {
  const visible = isMessageVisibleToSchool(
    { role: "direction", schoolId: "ecole-demo" },
    "ecole-demo",
    {
      cibleSchools: ["ecole-demo"],
      cibleRoles: ["direction", "admin"],
    },
  );

  assert.equal(visible, true);
});

test("un message global reste filtre par role", () => {
  const visible = isMessageVisibleToSchool(
    { role: "comptable", schoolId: "ecole-demo" },
    "ecole-demo",
    {
      cibleSchools: ["*"],
      cibleRoles: ["direction", "admin"],
    },
  );

  assert.equal(visible, false);
});

test("un message pour une autre ecole reste invisible", () => {
  const visible = isMessageVisibleToSchool(
    { role: "direction", schoolId: "ecole-a" },
    "ecole-a",
    {
      cibleSchools: ["ecole-b"],
      cibleRoles: ["direction"],
    },
  );

  assert.equal(visible, false);
});
