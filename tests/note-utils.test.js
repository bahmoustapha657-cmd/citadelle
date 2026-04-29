import test from "node:test";
import assert from "node:assert/strict";

import { getGeneralAverage, getSecondarySubjectAverage, getSubjectAverage } from "../src/note-utils.js";

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
