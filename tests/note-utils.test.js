import test from "node:test";
import assert from "node:assert/strict";

import { getAnnualAverage, getGeneralAverage, getSecondarySubjectAverage, getSubjectAverage } from "../src/note-utils.js";

test("getSecondarySubjectAverage applique la formule cours/composition du secondaire", () => {
  const notes = [
    { type: "Interrogation", note: 12 },
    { type: "Devoir", note: 15 },
    { type: "Composition", note: 9 },
  ];

  const moyenne = getSecondarySubjectAverage(notes);

  assert.equal(Number(moyenne.toFixed(4)), 10.5);
});

test("getSubjectAverage garde une moyenne simple au primaire", () => {
  const notes = [
    { type: "Devoir", note: 8 },
    { type: "Interrogation", note: 6 },
  ];

  assert.equal(getSubjectAverage(notes, "CM1"), 7);
});

test("getGeneralAverage combine les moyennes matieres du secondaire avec coefficients", () => {
  const notes = [
    { matiere: "Maths", type: "Interrogation", note: 12, periode: "T1" },
    { matiere: "Maths", type: "Devoir", note: 15, periode: "T1" },
    { matiere: "Maths", type: "Composition", note: 9, periode: "T1" },
    { matiere: "Physique", type: "Interrogation", note: 14, periode: "T1" },
    { matiere: "Physique", type: "Devoir", note: 10, periode: "T1" },
    { matiere: "Physique", type: "Composition", note: 12, periode: "T1" },
  ];
  const matieres = [
    { nom: "Maths", coefficient: 2 },
    { nom: "Physique", coefficient: 1 },
  ];

  const moyenne = getGeneralAverage(notes, matieres, "10ème Année A");

  assert.equal(Number(moyenne.toFixed(4)), 11);
});

test("getGeneralAverage compte les matières sans note comme 0 dans le dénominateur", () => {
  const notes = [
    { matiere: "Maths", type: "Interrogation", note: 12, periode: "T1" },
    { matiere: "Maths", type: "Devoir", note: 14, periode: "T1" },
    { matiere: "Maths", type: "Composition", note: 10, periode: "T1" },
  ];
  const matieres = [
    { nom: "Maths", coefficient: 2 },
    { nom: "Physique", coefficient: 3 },
  ];

  const moyenne = getGeneralAverage(notes, matieres, "10ème Année A");

  assert.equal(Number(moyenne.toFixed(4)), 4.4);
});

test("getAnnualAverage : (T1+T2+T3)/3 toutes périodes pleines", () => {
  assert.equal(getAnnualAverage([10, 12, 14]), 12);
});

test("getAnnualAverage : (S1+S2)/2 deux semestres", () => {
  assert.equal(getAnnualAverage([10, 14]), 12);
});

test("getAnnualAverage : période vide comptée 0 (diviseur fixe)", () => {
  // (10 + 14 + 0) / 3 = 8
  assert.equal(getAnnualAverage([10, 14, null]), 8);
});

test("getAnnualAverage : 2 périodes sur 3 vides (diviseur reste 3)", () => {
  // (12 + 0 + 0) / 3 = 4
  assert.equal(getAnnualAverage([12, null, null]), 4);
});

test("getAnnualAverage : toutes les périodes vides → null", () => {
  assert.equal(getAnnualAverage([null, null, null]), null);
});

test("getAnnualAverage : mensuel — 9 périodes pleines", () => {
  const sum = 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9; // 45
  assert.equal(getAnnualAverage([1, 2, 3, 4, 5, 6, 7, 8, 9]), sum / 9);
});

test("getAnnualAverage : input vide ou non-array → null", () => {
  assert.equal(getAnnualAverage([]), null);
  assert.equal(getAnnualAverage(), null);
});

test("getAnnualAverage : ignore les NaN/Infinity", () => {
  assert.equal(getAnnualAverage([10, NaN, Infinity, 14]), (10 + 14) / 4);
});
