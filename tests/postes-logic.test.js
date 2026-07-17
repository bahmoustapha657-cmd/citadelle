import assert from "node:assert/strict";
import test from "node:test";
import {
  MODULE_OPTIONS,
  cyclePermission,
  estPosteSupprimable,
  estPosteVerrouille,
  genererClePoste,
  roleCompteDuPoste,
  suggererLogin,
} from "../src/components/admin/postes/postes-logic.js";

test("MODULE_OPTIONS : uniquement les modules permissibles, jamais les portails", () => {
  const ids = MODULE_OPTIONS.map((m) => m.id);
  assert.ok(ids.includes("compta"));
  assert.ok(ids.includes("primaire"));
  assert.equal(ids.includes("superadmin_panel"), false);
  assert.equal(ids.includes("portail_parent"), false);
});

test("cyclePermission : invisible → lecture → écriture → invisible", () => {
  let perms = {};
  perms = cyclePermission(perms, "compta");
  assert.deepEqual(perms, { compta: "lecture" });
  perms = cyclePermission(perms, "compta");
  assert.deepEqual(perms, { compta: "ecriture" });
  perms = cyclePermission(perms, "compta");
  assert.deepEqual(perms, {});
});

test("cyclePermission ne touche pas les autres modules", () => {
  const perms = cyclePermission({ examens: "ecriture" }, "compta");
  assert.deepEqual(perms, { examens: "ecriture", compta: "lecture" });
});

test("genererClePoste : slug unique, accents neutralisés", () => {
  assert.equal(genererClePoste("Censeur des Études", []), "censeur-des-etudes");
  const existants = [{ cle: "censeur" }, { cle: "censeur-2" }];
  assert.equal(genererClePoste("Censeur", existants), "censeur-3");
});

test("verrou et suppression : direction intouchable, système non supprimable", () => {
  assert.equal(estPosteVerrouille({ cle: "direction" }), true);
  assert.equal(estPosteVerrouille({ cle: "comptable" }), false);
  assert.equal(estPosteSupprimable({ systeme: true, nbComptes: 0 }), false);
  assert.equal(estPosteSupprimable({ systeme: false, nbComptes: 2 }), false);
  assert.equal(estPosteSupprimable({ systeme: false, nbComptes: 0 }), true);
});

test("roleCompteDuPoste : postes système gardent le rôle enum, sinon staff", () => {
  assert.equal(roleCompteDuPoste({ systeme: true, cle: "comptable" }), "comptable");
  assert.equal(roleCompteDuPoste({ systeme: false, cle: "censeur" }), "staff");
});

test("suggererLogin : cle libre, puis suffixes -2, -3…", () => {
  const poste = { cle: "comptable" };
  assert.equal(suggererLogin(poste, []), "comptable");
  assert.equal(suggererLogin(poste, [{ login: "comptable" }]), "comptable-2");
  assert.equal(
    suggererLogin(poste, [{ login: "comptable" }, { login: "comptable-2" }]),
    "comptable-3",
  );
});
