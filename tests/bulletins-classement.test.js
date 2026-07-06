// Vérifie que l'impression groupée des bulletins ordonne les élèves par
// CLASSEMENT (meilleure moyenne en premier) au sein de chaque classe, classes
// regroupées, élèves sans note en dernier, égalités départagées par ordre
// alphabétique.
import test from "node:test";
import assert from "node:assert/strict";
import { ordonnerParClassement } from "../src/reports/bulletins/bulletin-helpers.js";

const matieres = [{ nom: "Maths", coefficient: 2 }, { nom: "Français", coefficient: 1 }];
const getMatCl = () => matieres;
const n = (eleveId, matiere, note) => ({ eleveId, matiere, periode: "T1", type: "Composition", note });

test("ordonnerParClassement : meilleure moyenne en premier au sein d'une classe", () => {
  const eleves = [
    { _id: "a", nom: "Zoumanigui", prenom: "Ali", classe: "6ème A" },
    { _id: "b", nom: "Bah", prenom: "Binta", classe: "6ème A" },
    { _id: "c", nom: "Camara", prenom: "Cé", classe: "6ème A" },
  ];
  const notes = [
    ...["Maths", "Français"].map((m) => n("a", m, 8)),   // a : 8
    ...["Maths", "Français"].map((m) => n("b", m, 18)),  // b : 18 (1er)
    ...["Maths", "Français"].map((m) => n("c", m, 12)),  // c : 12
  ];
  const { ordonnes } = ordonnerParClassement(eleves, notes, getMatCl, "T1", "secondaire");
  assert.deepEqual(ordonnes.map((e) => e._id), ["b", "c", "a"]);
});

test("ordonnerParClassement : classes regroupées, pas d'entrelacement", () => {
  const eleves = [
    { _id: "a1", nom: "Diallo", prenom: "A", classe: "6ème A" },
    { _id: "b1", nom: "Bah", prenom: "B", classe: "6ème B" },
    { _id: "a2", nom: "Camara", prenom: "C", classe: "6ème A" },
  ];
  const notes = [
    ...["Maths", "Français"].map((m) => n("a1", m, 10)),
    ...["Maths", "Français"].map((m) => n("b1", m, 20)),
    ...["Maths", "Français"].map((m) => n("a2", m, 15)),
  ];
  const { ordonnes } = ordonnerParClassement(eleves, notes, getMatCl, "T1", "secondaire");
  // 6ème A (ordre d'apparition en premier) : a2 (15) avant a1 (10) ; puis 6ème B : b1.
  assert.deepEqual(ordonnes.map((e) => e._id), ["a2", "a1", "b1"]);
});

test("ordonnerParClassement : élève sans note imprimé en dernier de sa classe", () => {
  const eleves = [
    { _id: "sans-note", nom: "Aabou", prenom: "Z", classe: "6ème A" }, // alphabétiquement premier mais aucune note
    { _id: "note", nom: "Zorro", prenom: "Y", classe: "6ème A" },
  ];
  const notes = ["Maths", "Français"].map((m) => n("note", m, 10));
  const { ordonnes } = ordonnerParClassement(eleves, notes, getMatCl, "T1", "secondaire");
  assert.deepEqual(ordonnes.map((e) => e._id), ["note", "sans-note"]);
});

test("ordonnerParClassement : égalité de rang départagée par ordre alphabétique", () => {
  const eleves = [
    { _id: "z", nom: "Zoumanigui", prenom: "Z", classe: "6ème A" },
    { _id: "a", nom: "Aabou", prenom: "A", classe: "6ème A" },
  ];
  const notes = [
    ...["Maths", "Français"].map((m) => n("z", m, 14)),
    ...["Maths", "Français"].map((m) => n("a", m, 14)), // même moyenne → même rang
  ];
  const { ordonnes, rangParEleve } = ordonnerParClassement(eleves, notes, getMatCl, "T1", "secondaire");
  assert.deepEqual(ordonnes.map((e) => e._id), ["a", "z"]); // alpha : Aabou avant Zoumanigui
  assert.equal(rangParEleve.get("a").rang, rangParEleve.get("z").rang); // même rang (égalité)
});
