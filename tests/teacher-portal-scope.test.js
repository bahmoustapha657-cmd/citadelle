import test from "node:test";
import assert from "node:assert/strict";

import { noteBelongsToTeacherScope } from "../api/_lib/handlers/teacher-portal.js";

const studentIds = new Set(["eleve-1", "eleve-2"]);
const studentNames = new Set(["aminata bah", "ibrahima diallo"]);

test("note in scope: matching eleveId + matching matiere (college)", () => {
  const note = { eleveId: "eleve-1", matiere: "Mathematiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college"),
    true,
  );
});

test("note out of scope: eleveId not in teacher classes", () => {
  const note = { eleveId: "eleve-99", matiere: "Mathematiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college"),
    false,
  );
});

test("note out of scope: wrong matiere in college", () => {
  const note = { eleveId: "eleve-1", matiere: "Histoire" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college"),
    false,
  );
});

test("F1 fix — secondaire sans matière de profil → refus systematique", () => {
  // Avant le fix, ce test passait à true (l'enseignant voyait toutes les matières).
  const note = { eleveId: "eleve-1", matiere: "Histoire" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "", studentNames, "college"),
    false,
  );
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "", studentNames, "lycee"),
    false,
  );
});

test("primaire sans matière → toutes matières acceptées (titulaire)", () => {
  // Un titulaire primaire enseigne toutes les matières de sa classe :
  // l'absence de matière de profil est légitime.
  const noteHistoire = { eleveId: "eleve-1", matiere: "Histoire" };
  const noteCalcul = { eleveId: "eleve-1", matiere: "Calcul" };
  assert.equal(
    noteBelongsToTeacherScope(noteHistoire, studentIds, "", studentNames, "primaire"),
    true,
  );
  assert.equal(
    noteBelongsToTeacherScope(noteCalcul, studentIds, "", studentNames, "primaire"),
    true,
  );
});

test("primaire avec matière → filtre matière respecté", () => {
  // Un primaire spécialisé (ex. prof d'anglais) doit aussi être filtré.
  const noteCalcul = { eleveId: "eleve-1", matiere: "Calcul" };
  const noteAnglais = { eleveId: "eleve-1", matiere: "Anglais" };
  assert.equal(
    noteBelongsToTeacherScope(noteCalcul, studentIds, "Anglais", studentNames, "primaire"),
    true,
    "primaire actuellement permissif sur la matière",
  );
  assert.equal(
    noteBelongsToTeacherScope(noteAnglais, studentIds, "Anglais", studentNames, "primaire"),
    true,
  );
});

test("matiere comparison ignore accents et casse", () => {
  const note = { eleveId: "eleve-1", matiere: "Mathématiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "MATHEMATIQUES", studentNames, "college"),
    true,
  );
});

test("fallback eleveNom: matching name + bonne matière (sans teacherClasses → legacy permissif)", () => {
  const note = { eleveNom: "Aminata Bah", matiere: "Mathematiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college"),
    true,
  );
});

test("fallback eleveNom: nom inconnu → refus", () => {
  const note = { eleveNom: "Mariama Sow", matiere: "Mathematiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college"),
    false,
  );
});

test("F2 durcissement — fallback eleveNom + classe in scope → OK", () => {
  const teacherClasses = new Set(["3eme A", "4eme B"]);
  const note = { eleveNom: "Aminata Bah", matiere: "Mathematiques", classe: "3eme A" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college", teacherClasses),
    true,
  );
});

test("F2 durcissement — fallback eleveNom + classe hors scope (homonymie inter-classes) → refus", () => {
  // Aminata Bah existe aussi en 5eme C avec un autre enseignant — la note de cette
  // homonyme ne doit PAS être visible par le prof de 3eme A.
  const teacherClasses = new Set(["3eme A", "4eme B"]);
  const note = { eleveNom: "Aminata Bah", matiere: "Mathematiques", classe: "5eme C" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college", teacherClasses),
    false,
  );
});

test("F2 durcissement — fallback eleveNom sans classe sur la note → refus", () => {
  const teacherClasses = new Set(["3eme A"]);
  const note = { eleveNom: "Aminata Bah", matiere: "Mathematiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college", teacherClasses),
    false,
  );
});

test("F2 durcissement — eleveId présent : classe pas exigée (path principal inchangé)", () => {
  const teacherClasses = new Set(["3eme A"]);
  const note = { eleveId: "eleve-1", matiere: "Mathematiques" }; // pas de classe
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college", teacherClasses),
    true,
  );
});

test("note sans eleveId ni eleveNom → refus", () => {
  const note = { matiere: "Mathematiques" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "Mathematiques", studentNames, "college"),
    false,
  );
});

test("section non reconnue → traitée comme secondaire (echec ferme)", () => {
  const note = { eleveId: "eleve-1", matiere: "Histoire" };
  assert.equal(
    noteBelongsToTeacherScope(note, studentIds, "", studentNames, "inconnue"),
    false,
  );
});
