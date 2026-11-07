import assert from "node:assert/strict";
import test from "node:test";
import { indexFratries } from "../src/fratrie.js";

const eleve = (id, prenom, classe, extra = {}) => ({
  _id: id, nom: "Diallo", prenom, classe, tuteur: "Mamadou Diallo", contactTuteur: "620 00 00 01", ...extra,
});

test("la fratrie réunit les enfants du même tuteur, toutes classes confondues, l'élève cliqué d'abord", () => {
  const aine = eleve("a", "Aïssatou", "8e A");
  const cadet = eleve("b", "Ibrahima", "CP1", { contactTuteur: "+224 620000001" }); // même numéro, autre écriture
  const benjamin = eleve("c", "Fatou", "6e B", { tuteur: "DIALLO Mamadou" });       // nom dans l'autre ordre
  const fratrieDe = indexFratries([aine, cadet, benjamin]);
  assert.deepEqual(fratrieDe(benjamin).map((e) => e._id), ["c", "a", "b"]);
  assert.equal(fratrieDe(aine)[0]._id, "a");
  assert.equal(fratrieDe(aine).length, 3);
});

test("un homonyme au numéro différent n'est pas rattaché", () => {
  const a = eleve("a", "Aïssatou", "8e A");
  const autre = eleve("z", "Oumar", "7e A", { contactTuteur: "621 99 99 99" });
  assert.deepEqual(indexFratries([a, autre])(a).map((e) => e._id), ["a"]);
});

test("sans numéro, la filiation commune rattache ; sans elle, rien", () => {
  const a = eleve("a", "Aïssatou", "8e A", { contactTuteur: "", filiation: "Mariama Bah" });
  const b = eleve("b", "Ibrahima", "CP1", { contactTuteur: "", filiation: "mariama BAH" });
  const c = eleve("c", "Fatou", "6e B", { contactTuteur: "" });
  assert.deepEqual(indexFratries([a, b, c])(a).map((e) => e._id), ["a", "b"]);
});

test("un élève sans tuteur reste seul, et n'est jamais compté deux fois", () => {
  const seul = { _id: "s", nom: "Bah", prenom: "Alpha", classe: "CE1", tuteur: "" };
  const a = eleve("a", "Aïssatou", "8e A");
  const fratrieDe = indexFratries([seul, a, a]);
  assert.deepEqual(fratrieDe(seul).map((e) => e._id), ["s"]);
  assert.deepEqual(fratrieDe(a).map((e) => e._id), ["a"]);
});
