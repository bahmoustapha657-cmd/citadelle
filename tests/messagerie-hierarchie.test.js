import assert from "node:assert/strict";
import test from "node:test";

import { contactables, peutContacter, peutLancerAppelGroupe } from "../src/components/messagerie/messagerie-logic.js";

const annuaireListe = [
  { id: "moi", contactable: false },
  { id: "principale", contactable: true },
  { id: "fondateur", contactable: false },
  { id: "ancien" }, // SQL de hiérarchie pas encore appliqué : champ absent
];
const annuaire = new Map(annuaireListe.map((c) => [c.id, c]));

test("hiérarchie : seules les personnes contactables sont proposées", () => {
  assert.deepEqual(contactables(annuaireListe, "moi").map((c) => c.id), ["principale", "ancien"]);
  assert.equal(peutContacter(undefined), false);
  assert.equal(peutContacter({ id: "x" }), true); // repli avant migration
});

test("hiérarchie : lancer un appel de groupe = admin du groupe ou responsable de tous", () => {
  const groupe = { membres: [{ id: "moi" }, { id: "principale" }, { id: "fondateur" }] };
  assert.equal(peutLancerAppelGroupe(groupe, annuaire, "moi"), false);
  assert.equal(peutLancerAppelGroupe({ ...groupe, admin: true }, annuaire, "moi"), true);
  assert.equal(peutLancerAppelGroupe({ membres: [{ id: "moi" }, { id: "principale" }] }, annuaire, "moi"), true);
});
