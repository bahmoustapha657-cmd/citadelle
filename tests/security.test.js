import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedSchoolRole,
  isValidLogin,
  isValidSchoolId,
  isValidTransferToken,
  normalizeLogin,
  normalizeSchoolId,
  normalizeTransferToken,
  validateSessionProfile,
} from "../api/_lib/security.js";

test("normalize helpers sanitize login, school id, and transfer token", () => {
  assert.equal(normalizeLogin("  Admin.User  "), "admin.user");
  assert.equal(normalizeSchoolId("  ECOLE-KINDIA  "), "ecole-kindia");
  assert.equal(normalizeTransferToken("  trf-ab234c  "), "TRF-AB234C");
});

test("security validators reject malformed identifiers", () => {
  assert.equal(isValidLogin("valid.user-01"), true);
  assert.equal(isValidLogin("NOPE"), false);
  assert.equal(isValidSchoolId("ecole-kindia"), true);
  assert.equal(isValidSchoolId("../bad"), false);
  assert.equal(isValidTransferToken("TRF-AB23CD"), true);
  assert.equal(isValidTransferToken("TRF-bad"), false);
});

test("allowed school roles do not include superadmin", () => {
  assert.equal(isAllowedSchoolRole("admin"), true);
  assert.equal(isAllowedSchoolRole("parent"), true);
  assert.equal(isAllowedSchoolRole("superadmin"), false);
});

test("validateSessionProfile rejects incomplete profiles", () => {
  assert.deepEqual(validateSessionProfile({}, {}), {
    ok: false,
    status: 403,
    error: "Profil utilisateur incomplet.",
  });
});

test("validateSessionProfile rejects wrong school access", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "admin", schoolId: "ecole-a" },
      { schoolId: "ecole-b" },
    ),
    {
      ok: false,
      status: 403,
      error: "Acces refuse pour cette ecole.",
    },
  );
});

test("validateSessionProfile rejects insufficient roles", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "parent", schoolId: "ecole-a" },
      { roles: ["admin", "direction"] },
    ),
    {
      ok: false,
      status: 403,
      error: "Droits insuffisants.",
    },
  );
});

test("validateSessionProfile allows a matching staff profile", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "admin", schoolId: "ecole-a" },
      { roles: ["admin", "direction"], schoolId: "ecole-a" },
    ),
    {
      ok: true,
      isSuperadmin: false,
    },
  );
});

test("validateSessionProfile lets superadmin bypass role and school checks only when allowed", () => {
  assert.deepEqual(
    validateSessionProfile(
      { role: "superadmin", schoolId: "central" },
      { roles: ["admin"], schoolId: "ecole-a", allowSuperadmin: true },
    ),
    {
      ok: true,
      isSuperadmin: true,
    },
  );

  assert.deepEqual(
    validateSessionProfile(
      { role: "superadmin", schoolId: "central" },
      { roles: ["admin"], schoolId: "ecole-a", allowSuperadmin: false },
    ),
    {
      ok: false,
      status: 403,
      error: "Acces refuse pour cette ecole.",
    },
  );
});
