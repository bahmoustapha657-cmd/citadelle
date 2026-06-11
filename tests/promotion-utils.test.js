// Tests du parseur de classe suivante (promotion de fin d'année).
// Contrat : chaîne = classe suivante ; null = fin de cycle (Terminale) ;
// undefined = classe non reconnue (aucune écriture).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classeSuivante } from "../src/promotion-utils.js";

test("Maternelle → 1ère Année (suffixe conservé)", () => {
  assert.equal(classeSuivante("Maternelle A"), "1ère Année A");
  assert.equal(classeSuivante("Maternelle B"), "1ère Année B");
  assert.equal(classeSuivante("Maternelle"), "1ère Année");
});

test("Progression primaire avec accents réels des constantes", () => {
  assert.equal(classeSuivante("1ère Année A"), "2ème Année A");
  assert.equal(classeSuivante("2ème Année B"), "3ème Année B");
  assert.equal(classeSuivante("5ème Année A"), "6ème Année A");
});

test("Passage primaire → collège (6ème → 7ème)", () => {
  assert.equal(classeSuivante("6ème Année A"), "7ème Année A");
  assert.equal(classeSuivante("6ème Année B"), "7ème Année B");
});

test("Collège guinéen 7ème → 10ème puis passage lycée", () => {
  assert.equal(classeSuivante("7ème Année A"), "8ème Année A");
  assert.equal(classeSuivante("9ème Année B"), "10ème Année B");
  assert.equal(classeSuivante("10ème Année A"), "11ème Année A");
});

test("Lycée : 11ème → 12ème → Terminale", () => {
  assert.equal(classeSuivante("11ème Année B"), "12ème Année B");
  assert.equal(classeSuivante("12ème Année A"), "Terminale A");
});

test("Terminale = fin de cycle (null)", () => {
  assert.equal(classeSuivante("Terminale A"), null);
  assert.equal(classeSuivante("Terminale"), null);
  assert.equal(classeSuivante("terminale b"), null);
});

test("Tolérance : ASCII legacy et casse", () => {
  assert.equal(classeSuivante("1ere Annee A"), "2ème Année A");
  assert.equal(classeSuivante("3eme annee"), "4ème Année");
  assert.equal(classeSuivante("MATERNELLE A"), "1ère Année A");
});

test("Suffixes personnalisés conservés tels quels", () => {
  assert.equal(classeSuivante("4ème Année Rouge"), "5ème Année Rouge");
  assert.equal(classeSuivante("8ème Année C"), "9ème Année C");
});

test("Classes non reconnues → undefined (aucune écriture)", () => {
  assert.equal(classeSuivante("CM2"), undefined);
  assert.equal(classeSuivante("Seconde A"), undefined);
  assert.equal(classeSuivante(""), undefined);
  assert.equal(classeSuivante(null), undefined);
  assert.equal(classeSuivante("13ème Année A"), undefined);
  assert.equal(classeSuivante("0ème Année"), undefined);
});
