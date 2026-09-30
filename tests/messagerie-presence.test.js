import assert from "node:assert/strict";
import test from "node:test";

import { estJoignable, libellePresence, membresConnectes } from "../src/components/messagerie/messagerie-logic.js";

test("présence : libellés à partir de l'état et de l'ancienneté (heure serveur)", () => {
  assert.equal(libellePresence({ etat: "actif", depuis: 20 }), "En ligne");
  assert.equal(libellePresence({ etat: "absent", depuis: 40 }), "Absent");
  assert.equal(libellePresence({ etat: "hors_ligne", depuis: 30 }), "Vu à l'instant");
  assert.equal(libellePresence({ etat: "hors_ligne", depuis: 12 * 60 }), "Vu il y a 12 min");
  assert.equal(libellePresence({ etat: "hors_ligne", depuis: 5 * 3600 + 100 }), "Vu il y a 5 h");
  assert.equal(libellePresence({ etat: "hors_ligne", depuis: 30 * 3600 }), "Vu hier");
  assert.equal(libellePresence({ etat: "hors_ligne", depuis: 9 * 86400 }), "Vu il y a 9 jours");
  assert.equal(libellePresence(undefined), "");
});

test("présence : joignable = application ouverte (à l'écran ou en arrière-plan)", () => {
  assert.equal(estJoignable({ etat: "actif" }), true);
  assert.equal(estJoignable({ etat: "absent" }), true);
  assert.equal(estJoignable({ etat: "hors_ligne" }), false);
  const presences = new Map([["a", { etat: "actif" }], ["b", { etat: "absent" }], ["c", { etat: "hors_ligne" }], ["moi", { etat: "actif" }]]);
  const conv = { membres: [{ id: "moi" }, { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] };
  assert.equal(membresConnectes(conv, presences, "moi"), 2);
});
