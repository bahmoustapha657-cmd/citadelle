import test from "node:test";
import assert from "node:assert/strict";

import {
  estEnseignee, estEvaluee, matieresEnseignees, matieresEvaluees, matieresNotablesPar, natureMatiere,
} from "../src/matiere-nature.js";
import { getGeneralAverage } from "../src/note-utils.js";
import { noteBelongsToTeacherScope } from "../src/backend/teacher-scope.js";

// Structure de La Citadelle visée : au collège, « Français » est enseigné
// (emploi du temps) mais ce sont « Dictée et Questions » et « Rédaction » qui
// sont notées et figurent au bulletin.
const COLLEGE = [
  { nom: "Mathématiques", coefficient: 2 },
  { nom: "Français", coefficient: 3, nature: "rubrique" },
  { nom: "Dictée et Questions", coefficient: 2, nature: "epreuve", rattachement: "Français" },
  { nom: "Rédaction", coefficient: 1, nature: "epreuve", rattachement: "Français" },
];
const noms = (liste) => liste.map((m) => m.nom);

test("nature : une matière sans nature (créée avant) reste enseignée ET évaluée", () => {
  assert.equal(natureMatiere({ nom: "Calcul" }), "matiere");
  assert.equal(natureMatiere({ nom: "Calcul", nature: "inconnue" }), "matiere");
  assert.equal(estEvaluee({ nom: "Calcul" }), true);
  assert.equal(estEnseignee({ nom: "Calcul" }), true);
});

test("nature : emploi du temps = matières + rubriques, notes = matières + épreuves", () => {
  assert.deepEqual(noms(matieresEnseignees(COLLEGE)), ["Mathématiques", "Français"]);
  assert.deepEqual(noms(matieresEvaluees(COLLEGE)), ["Mathématiques", "Dictée et Questions", "Rédaction"]);
});

test("moyenne générale : une rubrique enseignée seulement ne compte jamais, même passée par erreur", () => {
  const notes = [
    { matiere: "Mathématiques", type: "Moyenne", note: 12 },
    { matiere: "Dictée et Questions", type: "Moyenne", note: 15 },
    { matiere: "Rédaction", type: "Moyenne", note: 9 },
  ];
  // (12×2 + 15×2 + 9×1) / 5 = 12,6 — sans le coefficient 3 de « Français ».
  assert.equal(Number(getGeneralAverage(notes, COLLEGE, "7ème Année A").toFixed(2)), 12.6);
  assert.equal(
    getGeneralAverage(notes, COLLEGE, "7ème Année A"),
    getGeneralAverage(notes, matieresEvaluees(COLLEGE), "7ème Année A"),
  );
});

test("portail : le professeur de Français note les épreuves rattachées, pas la rubrique", () => {
  assert.deepEqual(noms(matieresNotablesPar(COLLEGE, "Français")), ["Dictée et Questions", "Rédaction"]);
  // Même comparaison que la RLS (lower/btrim).
  assert.deepEqual(noms(matieresNotablesPar(COLLEGE, "  français ")), ["Dictée et Questions", "Rédaction"]);
  assert.deepEqual(noms(matieresNotablesPar(COLLEGE, "Mathématiques")), ["Mathématiques"]);
  assert.deepEqual(matieresNotablesPar(COLLEGE, ""), []);
  assert.deepEqual(matieresNotablesPar(COLLEGE, "Anglais"), []);
});

test("périmètre des notes : la matière du profil et ses matières rattachées", () => {
  const ids = new Set(["e1"]);
  const autorisees = ["Français", "Dictée et Questions", "Rédaction"];
  for (const matiere of autorisees) {
    assert.equal(noteBelongsToTeacherScope({ eleveId: "e1", matiere }, ids, autorisees, new Set(), "college"), true, matiere);
  }
  assert.equal(noteBelongsToTeacherScope({ eleveId: "e1", matiere: "Mathématiques" }, ids, autorisees, new Set(), "college"), false);
  assert.equal(noteBelongsToTeacherScope({ eleveId: "e1", matiere: "" }, ids, ["", "Rédaction"], new Set(), "college"), false);
  assert.equal(noteBelongsToTeacherScope({ eleveId: "e1", matiere: "Rédaction" }, ids, [], new Set(), "college"), false);
});
