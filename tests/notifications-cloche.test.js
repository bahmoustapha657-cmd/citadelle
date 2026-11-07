import assert from "node:assert/strict";
import test from "node:test";

import { NB_NOTIFS, ecrireVu, horodatage, lireVu, preparerNotifs } from "../src/notifications-cloche.js";
import { suivreCompteur } from "../src/hooks/suivre-compteur.js";

const stockage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test("preparerNotifs : les plus récentes d'abord, au plus NB_NOTIFS", () => {
  const items = Array.from({ length: 15 }, (_, i) => ({ _id: `h${i}`, action: `A${i}`, date: 1000 + i }));
  const { liste } = preparerNotifs(items, 0);
  assert.equal(liste.length, NB_NOTIFS);
  assert.equal(liste[0].id, "h14");
  assert.equal(liste.at(-1).id, "h5");
});

test("preparerNotifs : la pastille compte ce qui est postérieur à la dernière ouverture", () => {
  const items = [
    { _id: "a", action: "Encaissement", date: 100 },
    { _id: "b", action: "Suppression", date: 300 },
    { _id: "c", action: "Compte", date: 500 },
  ];
  assert.equal(preparerNotifs(items, 200).nonLues, 2);
  assert.equal(preparerNotifs(items, 500).nonLues, 0);
});

test("preparerNotifs : ignore les lignes sans action, accepte une date ISO", () => {
  const iso = "2026-10-15T08:00:00.000Z";
  const { liste } = preparerNotifs([{ _id: "x", date: 5 }, { _id: "y", action: "Ancienne", date: iso }, null], 0);
  assert.deepEqual(liste.map((n) => n.id), ["y"]);
  assert.equal(liste[0].date, Date.parse(iso));
  assert.equal(horodatage(undefined), 0);
});

test("lireVu : première visite = maintenant (pas de pastille d'emblée), puis valeur mémorisée", () => {
  const s = stockage();
  const avant = Date.now();
  const vu = lireVu("ECOLE", s);
  assert.ok(vu >= avant);
  ecrireVu("ECOLE", 42, s);
  assert.equal(lireVu("ECOLE", s), 42);
  assert.ok(lireVu("AUTRE", s) >= avant);
});

test("suivreCompteur : estValide permet de suivre une liste", async () => {
  const recu = [];
  const arreter = suivreCompteur({
    compter: async () => [{ action: "A" }],
    estValide: Array.isArray,
    surveiller: () => () => {},
    onValeur: (v) => recu.push(v),
  });
  await new Promise((r) => setTimeout(r, 10));
  arreter();
  assert.equal(recu.length, 1);
  assert.deepEqual(recu[0], [{ action: "A" }]);
});
