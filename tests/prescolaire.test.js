import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSectionForClasse, getSectionLabel, getClassesForSection,
  getToutesClassesConnues, SECTIONS_ECOLE, CLASSES_PRESCOLAIRE,
} from "../src/constants.js";

test("les classes de maternelle sont rattachées au préscolaire", () => {
  for (const classe of [
    "Petite Section A", "Moyenne Section B", "Grande Section C",
    "petite section", "GRANDE SECTION D",
    "Maternelle A", "Maternelle B", "Maternelle D", "maternelle",
  ]) {
    assert.equal(getSectionForClasse(classe), "prescolaire", classe);
  }
});

test("les autres sections ne sont PAS affectées par le changement", () => {
  const attendus = {
    "1ère Année A": "primaire", "6ème Année B": "primaire",
    "CP A": "primaire", "CE1 B": "primaire", "CM2 C": "primaire",
    "7ème Année A": "college", "10ème Année B": "college",
    "6ème A": "college", "3ème B": "college",
    "11ème Année A": "lycee", "Terminale C": "lycee",
    "Seconde A": "lycee", "Première D": "lycee",
  };
  for (const [classe, section] of Object.entries(attendus)) {
    assert.equal(getSectionForClasse(classe), section, classe);
  }
});

test("« 1ère Année » (primaire) ne doit pas être confondue avec « Première » (lycée)", () => {
  assert.equal(getSectionForClasse("1ère Année A"), "primaire");
  assert.equal(getSectionForClasse("Première A"), "lycee");
});

test("libellé de section", () => {
  assert.equal(getSectionLabel("prescolaire"), "Préscolaire");
  assert.equal(getSectionLabel("primaire"), "Primaire");
  assert.equal(getSectionLabel("college"), "Collège");
  assert.equal(getSectionLabel("lycee"), "Lycée");
});

test("classes proposées pour le préscolaire : 3 niveaux × 4 divisions", () => {
  for (const systeme of ["guineen", "francophone"]) {
    const classes = getClassesForSection("prescolaire", systeme);
    assert.equal(classes.length, 12, systeme);
    assert.ok(classes.includes("Petite Section A"), systeme);
    assert.ok(classes.includes("Grande Section D"), systeme);
  }
});

test("la maternelle a bien QUITTÉ le primaire dans les deux systèmes", () => {
  for (const systeme of ["guineen", "francophone"]) {
    const primaire = getClassesForSection("primaire", systeme);
    assert.ok(!primaire.some((c) => /section|maternelle/i.test(c)), systeme);
  }
});

test("le préscolaire fait partie des sections de l'école et des classes connues", () => {
  assert.ok(SECTIONS_ECOLE.includes("prescolaire"));
  const toutes = getToutesClassesConnues();
  for (const c of CLASSES_PRESCOLAIRE) assert.ok(toutes.includes(c), c);
});
