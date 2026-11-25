import assert from "node:assert/strict";
import test from "node:test";
import { compterParType, filtrerComptes, typeCompte } from "../src/components/admin/admin-panel/comptes-filtre.js";

const COMPTES = [
  { _id: "1", role: "direction", nom: "Direction Générale", login: "direction", label: "Direction" },
  { _id: "2", role: "comptable", nom: "Aïda Exemple", login: "compta", email: "compta@exemple.org", label: "Comptabilité" },
  { _id: "3", role: "poste_censeur", nom: "Censeur", login: "censeur", label: "Censeur des études" },
  { _id: "4", role: "enseignant", nom: "Prof Maths", login: "622 55 50 01", label: "Enseignant" },
  { _id: "5", role: "parent", nom: "Parent Élève", login: "parent.eleve", label: "Parent" },
  { _id: "6", role: "parent", nom: "Autre Parent", login: "autre.parent", label: "Parent" },
];

const ids = (liste) => liste.map((c) => c._id);

test("type de compte : enseignant, parent, et tout le reste en personnel", () => {
  assert.equal(typeCompte({ role: "enseignant" }), "enseignant");
  assert.equal(typeCompte({ role: "parent" }), "parent");
  assert.equal(typeCompte({ role: "direction" }), "personnel");
  assert.equal(typeCompte({ role: "poste_censeur" }), "personnel");
  assert.equal(typeCompte({}), "personnel");
});

test("compte les comptes par type", () => {
  assert.deepEqual(compterParType(COMPTES), { tous: 6, personnel: 3, enseignant: 1, parent: 2 });
  assert.deepEqual(compterParType([]), { tous: 0, personnel: 0, enseignant: 0, parent: 0 });
});

test("filtre par type", () => {
  assert.deepEqual(ids(filtrerComptes(COMPTES, { type: "personnel" })), ["1", "2", "3"]);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { type: "parent" })), ["5", "6"]);
  assert.equal(filtrerComptes(COMPTES, { type: "tous" }).length, 6);
  assert.equal(filtrerComptes(COMPTES).length, 6);
});

test("recherche sans accents ni casse, sur le nom, l'identifiant, l'e-mail et le poste", () => {
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "aida" })), ["2"]);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "COMPTA@" })), ["2"]);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "censeur des" })), ["3"]);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "eleve" })), ["5"]);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "   " })), ids(COMPTES));
});

test("un numéro se retrouve avec ou sans espaces", () => {
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "622555001" })), ["4"]);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { recherche: "55 50" })), ["4"]);
});

test("type et recherche se combinent", () => {
  assert.deepEqual(ids(filtrerComptes(COMPTES, { type: "personnel", recherche: "parent" })), []);
  assert.deepEqual(ids(filtrerComptes(COMPTES, { type: "parent", recherche: "autre" })), ["6"]);
});
