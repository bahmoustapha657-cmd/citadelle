import assert from "node:assert/strict";
import test from "node:test";
import { anneesApresSaisie, anneesApresSignature } from "../src/components/livrets-tab/livrets-logic.js";

// Ces fonctions construisent la liste `annees` envoyée par useLivretsTab via
// modifierChamp(id, { annees }). Le choix du mutateur, lui, vit dans le hook
// React : il n'est pas couvert ici (pas de banc de test React dans le dépôt).

const entree = (anneeScolaire, champs = {}) => ({
  anneeScolaire, classe: "6e A", decision: "Admis",
  notes: [{ matiere: "Maths", coef: 4, annuelle: 12.5 }],
  signe: false, dateSigne: null, ...champs,
});

test("anneesApresSaisie : une nouvelle année s'ajoute en fin de livret", () => {
  const avant = [entree("2024-2025")];
  const apres = anneesApresSaisie(avant, entree("2025-2026"));
  assert.deepEqual(apres.map((a) => a.anneeScolaire), ["2024-2025", "2025-2026"]);
  assert.equal(avant.length, 1, "la liste du livret affiché n'est pas modifiée en place");
});

test("anneesApresSaisie : première année d'un livret vide ou sans champ annees", () => {
  assert.deepEqual(anneesApresSaisie([], entree("2025-2026")), [entree("2025-2026")]);
  assert.deepEqual(anneesApresSaisie(undefined, entree("2025-2026")), [entree("2025-2026")]);
});

test("anneesApresSaisie : l'édition remplace l'entrée visée, index 0 compris", () => {
  const avant = [entree("2024-2025"), entree("2025-2026")];
  const apres = anneesApresSaisie(avant, { ...avant[0], rang: "3", _idx: 0 });
  assert.equal(apres.length, 2);
  assert.equal(apres[0].rang, "3");
  assert.equal(apres[0].anneeScolaire, "2024-2025");
  assert.equal(apres[1], avant[1]);
  assert.equal(avant[0].rang, undefined, "l'entrée d'origine n'est pas modifiée en place");
});

test("anneesApresSaisie : le marqueur d'édition _idx n'est jamais persisté", () => {
  const apres = anneesApresSaisie([entree("2024-2025")], { ...entree("2024-2025"), _idx: 0 });
  assert.equal(Object.hasOwn(apres[0], "_idx"), false);
  const ajout = anneesApresSaisie([], entree("2025-2026"));
  assert.equal(Object.hasOwn(ajout[0], "_idx"), false);
});

test("anneesApresSignature : signe et date l'entrée visée, sans toucher aux autres", () => {
  const avant = [entree("2024-2025"), entree("2025-2026")];
  const apres = anneesApresSignature(avant, 1, "2026-09-23");
  assert.deepEqual(apres[1], { ...avant[1], signe: true, dateSigne: "2026-09-23" });
  assert.equal(apres[0], avant[0]);
  assert.equal(avant[1].signe, false, "la liste du livret affiché n'est pas modifiée en place");
});
