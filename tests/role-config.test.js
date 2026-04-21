import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveRoleAccounts,
  getPrimaryModuleForRole,
  getRoleSettingsMap,
  normalizeRoleLogin,
} from "../shared/role-config.js";

test("normalizeRoleLogin sanitizes accents and spaces", () => {
  assert.equal(normalizeRoleLogin(" Direction Générale ", "directeur"), "direction-generale");
});

test("getRoleSettingsMap keeps direction active and preserves required admin modules", () => {
  const settings = getRoleSettingsMap({
    direction: { active: false, modules: ["accueil"] },
    admin: { modules: ["historique"] },
  });

  assert.equal(settings.direction.active, true);
  assert.equal(settings.direction.modules.includes("admin_panel"), true);
  assert.equal(settings.direction.modules.includes("parametres"), true);
  assert.equal(settings.admin.modules.includes("admin_panel"), true);
  assert.equal(settings.admin.modules.includes("parametres"), true);
});

test("getActiveRoleAccounts filters disabled roles and getPrimaryModuleForRole uses school config", () => {
  const schoolInfo = {
    roleSettings: {
      primaire: { active: false },
      college: { modules: ["examens", "secondaire"] },
    },
  };

  const accounts = getActiveRoleAccounts(schoolInfo);

  assert.equal(accounts.some((account) => account.role === "primaire"), false);
  assert.equal(getPrimaryModuleForRole("college", schoolInfo), "examens");
});
