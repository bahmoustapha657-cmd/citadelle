import test from "node:test";
import assert from "node:assert/strict";

import { getEligibleTeachersForTimetable, getTeacherMonthlyForfait } from "../src/teacher-utils.js";

test("getTeacherMonthlyForfait prefers the teacher forfait fields", () => {
  assert.equal(getTeacherMonthlyForfait({ montantForfait: 850000 }), 850000);
  assert.equal(getTeacherMonthlyForfait({ salaireBase: 650000 }), 650000);
  assert.equal(getTeacherMonthlyForfait({}), 0);
});

test("primary timetable teacher filtering prefers titulaires of the current class", () => {
  const teachers = [
    { prenom: "A", nom: "One", classeTitle: "3eme Annee A", matiere: "Lecture" },
    { prenom: "B", nom: "Two", classeTitle: "4eme Annee A", matiere: "Lecture" },
    { prenom: "C", nom: "Three", matiere: "Lecture" },
  ];

  const result = getEligibleTeachersForTimetable(teachers, {
    classe: "3eme Annee A",
    matiere: "Lecture",
    isPrimary: true,
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].nom, "One");
});

test("primary timetable teacher filtering falls back to subject matches when no titulaire exists", () => {
  const teachers = [
    { prenom: "A", nom: "One", classeTitle: "5eme Annee A", matiere: "Lecture" },
    { prenom: "B", nom: "Two", matiere: "Lecture" },
    { prenom: "C", nom: "Three", matiere: "Maths" },
  ];

  const result = getEligibleTeachersForTimetable(teachers, {
    classe: "3eme Annee A",
    matiere: "Lecture",
    isPrimary: true,
  });

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((teacher) => teacher.nom), ["One", "Two"]);
});
