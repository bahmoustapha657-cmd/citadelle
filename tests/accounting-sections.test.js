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

test("les listes prédéfinies offrent 4 divisions (A→D) par niveau", () => {
  assert.ok(CLASSES_LYCEE.includes("Terminale C"));
  assert.ok(CLASSES_LYCEE.includes("11ème Année D"));
  assert.equal(getClassesForSection("primaire").length, 7 * 4);
  assert.equal(getClassesForSection("college").length, 4 * 4);
});

test("détection de section par motif — suffixes libres hors listes", () => {
  // Primaire (niveaux 1-6 + maternelle), quel que soit le suffixe
  assert.equal(getSectionForClasse("Maternelle Rouge"), "primaire");
  assert.equal(getSectionForClasse("3ème Année E"), "primaire");
  assert.equal(getSectionForClasse("6ème Année F"), "primaire");
  // Collège (7-10)
  assert.equal(getSectionForClasse("7ème Année E"), "college");
  assert.equal(getSectionForClasse("10ème Année G"), "college");
  // Lycée (11-12 + Terminale)
  assert.equal(getSectionForClasse("11ème Année E"), "lycee");
  assert.equal(getSectionForClasse("Terminale E"), "lycee");
  // Tolérance ASCII / casse
  assert.equal(getSectionForClasse("2eme annee c"), "primaire");
  // Nom totalement personnalisé → collège (comportement historique)
  assert.equal(getSectionForClasse("Classe Spéciale"), "college");
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
