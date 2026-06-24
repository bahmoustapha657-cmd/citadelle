// Vérifie que la fiche de résultats ne compte QUE les matières prises en
// charge par la classe (pas la liste globale de la section), et que la
// moyenne obtenue correspond bien à la moyenne « compositions » du bulletin.
import test from "node:test";
import assert from "node:assert/strict";
import { computeFicheResultats } from "../src/reports/bulletins/fiche-compositions-data.js";
import { getGeneralAverage } from "../src/note-utils.js";

const classe = "6ème"; // secondaire (système francophone)
// Section : 3 matières ; la classe « 6ème » n'en prend que 2 (pas Anglais).
const matieresSection = [
  { nom: "Maths", coefficient: 2 },
  { nom: "Français", coefficient: 1 },
  { nom: "Anglais", coefficient: 1 },
];
const matsClasse = [
  { nom: "Maths", coefficient: 2 },
  { nom: "Français", coefficient: 1 },
];
const matieresForClasse = () => matsClasse;
const eleves = [{ _id: "e1", nom: "Diallo", prenom: "A", classe }];
const notes = [
  { eleveId: "e1", matiere: "Maths", periode: "T1", type: "Composition", note: 12 },
  { eleveId: "e1", matiere: "Français", periode: "T1", type: "Composition", note: 10 },
];

test("BUG corrigé : seules les matières de la classe comptent au dénominateur", () => {
  const { resultats } = computeFicheResultats({
    classe, periode: "T1", notes, matieres: matsClasse, eleves, maxNote: 20, matieresForClasse,
  });
  // (12×2 + 10×1) / (2+1) = 34/3 = 11.333…  (et NON /4 avec Anglais)
  assert.ok(Math.abs(resultats[0].moyGene - 34 / 3) < 1e-9, `obtenu ${resultats[0].moyGene}`);
});

test("ancien comportement (sans matieresForClasse) : Anglais non pris en charge dilue à tort", () => {
  const { resultats } = computeFicheResultats({
    classe, periode: "T1", notes, matieres: matieresSection, eleves, maxNote: 20,
  });
  // (12×2 + 10×1 + 0×1) / 4 = 8.5 — c'est précisément le bug signalé.
  assert.ok(Math.abs(resultats[0].moyGene - 8.5) < 1e-9, `obtenu ${resultats[0].moyGene}`);
});

test("fiche (compositions) = moyenne compositions du bulletin (mêmes matières de classe)", () => {
  const { resultats } = computeFicheResultats({
    classe, periode: "T1", notes, matieres: matsClasse, eleves, maxNote: 20, matieresForClasse,
  });
  const bulletinCompo = getGeneralAverage(notes, matsClasse, classe, "secondaire");
  assert.ok(Math.abs(resultats[0].moyGene - bulletinCompo) < 1e-9,
    `fiche ${resultats[0].moyGene} ≠ bulletin ${bulletinCompo}`);
});
