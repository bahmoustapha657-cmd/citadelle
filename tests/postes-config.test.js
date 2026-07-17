import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_POSTES,
  FULL_PERMISSIONS,
  MODULES_PERMISSIBLES,
  getDefaultPoste,
  getSessionPermissions,
  hasRead,
  hasWrite,
  legacyPermissionsForRole,
  normalizePermissions,
  readableModules,
} from "../shared/postes-config.js";

test("normalizePermissions ne garde que les modules connus et les niveaux valides", () => {
  const perms = normalizePermissions({
    compta: "ecriture",
    primaire: "lecture",
    inconnu: "ecriture",        // module inexistant → ignoré
    secondaire: "total",         // niveau invalide → ignoré
    portail_parent: "lecture",   // portail → jamais permissible
  });
  assert.deepEqual(perms, { compta: "ecriture", primaire: "lecture" });
});

test("normalizePermissions tolère null / non-objet", () => {
  assert.deepEqual(normalizePermissions(null), {});
  assert.deepEqual(normalizePermissions("compta"), {});
  assert.deepEqual(normalizePermissions(undefined), {});
});

test("hasRead / hasWrite : écriture implique lecture, absent = rien", () => {
  const perms = { compta: "ecriture", primaire: "lecture" };
  assert.equal(hasWrite(perms, "compta"), true);
  assert.equal(hasRead(perms, "compta"), true);
  assert.equal(hasWrite(perms, "primaire"), false);
  assert.equal(hasRead(perms, "primaire"), true);
  assert.equal(hasRead(perms, "secondaire"), false);
  assert.equal(hasRead(null, "compta"), false);
});

test("direction et superadmin ont toujours tous les droits", () => {
  for (const role of ["direction", "superadmin"]) {
    const perms = legacyPermissionsForRole(role);
    for (const moduleId of MODULES_PERMISSIBLES) {
      assert.equal(hasWrite(perms, moduleId), true, `${role} doit écrire ${moduleId}`);
    }
  }
  assert.deepEqual(legacyPermissionsForRole("direction"), FULL_PERMISSIONS);
});

test("repli legacy comptable : compta en écriture, rien d'autre", () => {
  const perms = legacyPermissionsForRole("comptable");
  assert.deepEqual(perms, { compta: "ecriture" });
});

test("repli legacy admin : lecture sur les modules visibles, écriture selon writeModules du DG", () => {
  // Sans config stockée, seuls les modules requis (admin_panel, parametres)
  // sont visibles — même comportement que getRoleModules aujourd'hui.
  const sansConfig = legacyPermissionsForRole("admin", {});
  assert.equal(hasRead(sansConfig, "compta"), false);
  assert.equal(hasWrite(sansConfig, "admin_panel"), true);
  assert.equal(hasWrite(sansConfig, "parametres"), true);

  const avecConfig = legacyPermissionsForRole("admin", {
    roleSettings: {
      admin: {
        modules: ["accueil", "compta", "primaire", "examens"],
        writeModules: ["primaire", "examens"],
      },
    },
  });
  assert.equal(hasRead(avecConfig, "compta"), true);
  assert.equal(hasWrite(avecConfig, "compta"), false);
  assert.equal(hasWrite(avecConfig, "primaire"), true);
  assert.equal(hasWrite(avecConfig, "examens"), true);
  assert.equal(hasWrite(avecConfig, "secondaire"), false);
});

test("repli legacy surveillant / sections : écriture sur leur périmètre", () => {
  assert.equal(hasWrite(legacyPermissionsForRole("surveillant"), "primaire"), true);
  assert.equal(hasRead(legacyPermissionsForRole("surveillant"), "compta"), false);
  assert.equal(hasWrite(legacyPermissionsForRole("primaire"), "primaire"), true);
  assert.equal(hasRead(legacyPermissionsForRole("primaire"), "secondaire"), false);
  assert.equal(hasWrite(legacyPermissionsForRole("college"), "secondaire"), true);
});

test("rôle inconnu ou portail → aucune permission", () => {
  assert.deepEqual(legacyPermissionsForRole("enseignant"), {});
  assert.deepEqual(legacyPermissionsForRole("parent"), {});
  assert.deepEqual(legacyPermissionsForRole("fantome"), {});
});

test("getSessionPermissions : le poste prime, sinon repli rôle", () => {
  const surPoste = getSessionPermissions({
    role: "staff",
    permissions: { examens: "ecriture", compta: "bidon" },
  });
  assert.deepEqual(surPoste, { examens: "ecriture" });

  const legacy = getSessionPermissions({ role: "comptable", permissions: null });
  assert.deepEqual(legacy, { compta: "ecriture" });
});

test("DEFAULT_POSTES : 6 gabarits système alignés sur les rôles historiques", () => {
  assert.equal(DEFAULT_POSTES.length, 6);
  const cles = DEFAULT_POSTES.map((p) => p.cle);
  assert.deepEqual(cles, ["direction", "admin", "comptable", "surveillant", "primaire", "college"]);
  for (const poste of DEFAULT_POSTES) {
    assert.equal(poste.systeme, true);
    assert.ok(poste.label && poste.loginDefaut, `gabarit ${poste.cle} complet`);
  }
  assert.deepEqual(getDefaultPoste("direction").permissions, FULL_PERMISSIONS);
  assert.deepEqual(getDefaultPoste("comptable").permissions, { compta: "ecriture" });
  assert.equal(getDefaultPoste("censeur"), null);
});

test("readableModules liste les modules visibles dans l'ordre canonique", () => {
  assert.deepEqual(
    readableModules({ examens: "ecriture", compta: "lecture", inconnu: "ecriture" }),
    ["compta", "examens"],
  );
});
