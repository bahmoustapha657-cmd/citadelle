import assert from "node:assert/strict";
import test from "node:test";
import {
  MODULE_OPTIONS,
  comptesRattaches,
  cyclePermission,
  nomsSignatureParPoste,
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

// Poste à plusieurs comptes : quels comptes lui appartiennent, et quels noms ils
// impriment sous leur signature (Qui signe quoi).
const POSTES = [
  { id: "p-compta", cle: "comptable", systeme: true },
  { id: "p-censeur", cle: "censeur", systeme: false },
];
const COMPTES = [
  { _id: "c1", posteId: "p-compta", role: "comptable", nomSignature: "Binta Camara" },
  { _id: "c2", posteId: "p-compta", role: "comptable", nomSignature: " Alpha Barry " },
  // Compte legacy sans poste : rattaché au poste système de même clé.
  { _id: "c3", posteId: null, role: "comptable", nomSignature: "" },
  { _id: "c4", posteId: "p-censeur", role: "staff" },
  // Même rôle mais rattaché à un autre poste : pas au comptable.
  { _id: "c5", posteId: "p-censeur", role: "comptable", nomSignature: "Ibrahima Sow" },
];

test("comptesRattaches : par poste, et comptes legacy par rôle sur un poste système", () => {
  assert.deepEqual(comptesRattaches(POSTES[0], COMPTES).map((c) => c._id), ["c1", "c2", "c3"]);
  assert.deepEqual(comptesRattaches(POSTES[1], COMPTES).map((c) => c._id), ["c4", "c5"]);
});

test("nomsSignatureParPoste : seuls les comptes nommés, sans doublon", () => {
  assert.deepEqual(nomsSignatureParPoste(POSTES, COMPTES), {
    comptable: ["Binta Camara", "Alpha Barry"],
    censeur: ["Ibrahima Sow"],
  });
  assert.deepEqual(nomsSignatureParPoste(POSTES, []), {});
});
