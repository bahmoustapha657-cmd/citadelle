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

test("comptable est strictement limité au module compta, même avec une config stockée plus large", () => {
  // Une école ayant enregistré l'ancien périmètre (primaire/secondaire/etc.)
  // doit être ramenée à ["compta"] : normalizeModules filtre contre les
  // capacités du rôle, côté client ET côté API (shared/role-config.js).
  const schoolInfo = {
    roleSettings: {
      comptable: { modules: ["compta", "primaire", "secondaire", "calendrier", "examens"] },
    },
  };

  assert.deepEqual(getRoleSettingsMap(schoolInfo).comptable.modules, ["compta"]);
  assert.equal(getPrimaryModuleForRole("comptable", schoolInfo), "compta");
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
