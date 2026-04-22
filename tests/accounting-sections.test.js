import assert from "node:assert/strict";
import test from "node:test";
import {
  CLASSES_LYCEE,
  genererMatricule,
  getClassesForSection,
  getDefaultMensualiteForClasse,
  getSectionForClasse,
  getTarifAutreValue,
  getTarifMensuelTotal,
  getTarifRevisionValue,
} from "../src/constants.js";

test("lycee classes resolve to the lycee section and default monthly fee", () => {
  assert.equal(getSectionForClasse("Terminale A"), "lycee");
  assert.equal(getDefaultMensualiteForClasse("Terminale A"), 150000);
  assert.deepEqual(getClassesForSection("lycee"), CLASSES_LYCEE);
});

test("lycee matricules default to the L prefix", () => {
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => "2025-2026" };

  try {
    const matricule = genererMatricule([], "lycee", {});
    assert.match(matricule, /^L25-\d{3}$/);
  } finally {
    globalThis.localStorage = previousLocalStorage;
  }
});

test("tarif helpers include revision in the monthly total and expose other fees", () => {
  const tarif = { montant: 180000, revision: 20000, autre: 15000 };

  assert.equal(getTarifRevisionValue(tarif), 20000);
  assert.equal(getTarifAutreValue(tarif), 15000);
  assert.equal(getTarifMensuelTotal(tarif, "Terminale A"), 200000);
});
