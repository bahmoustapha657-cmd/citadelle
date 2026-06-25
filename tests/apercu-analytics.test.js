// Calculs du tableau de bord analytique (direction). Une seule note "Devoir"
// par matière → getSubjectAverage renvoie la note telle quelle quelle que soit
// la section, ce qui rend les attentes déterministes.
import test from "node:test";
import assert from "node:assert/strict";
import {
  statsGroupe, statsParClasse, moyenneParMatiere, evolutionMoyenne, statsGenre,
} from "../src/components/ecole/apercu-tab/analytics.js";

const matieres = [
  { nom: "Maths", coefficient: 1 },
  { nom: "Français", coefficient: 1 },
];
const matieresForClasse = () => matieres;
const classes = [{ nom: "CM2" }];
const eleves = [
  { _id: "e1", nom: "Diallo", prenom: "A", classe: "CM2", sexe: "F", statut: "Actif" },
  { _id: "e2", nom: "Bah", prenom: "M", classe: "CM2", sexe: "M", statut: "Actif" },
];
const notes = [
  { eleveId: "e1", matiere: "Maths", periode: "T1", type: "Devoir", note: 12 },
  { eleveId: "e1", matiere: "Français", periode: "T1", type: "Devoir", note: 8 },
  { eleveId: "e2", matiere: "Maths", periode: "T1", type: "Devoir", note: 6 },
  { eleveId: "e2", matiere: "Français", periode: "T1", type: "Devoir", note: 4 },
];
const seuil = 10;

test("statsGroupe : moyenne, admis et taux de réussite", () => {
  const st = statsGroupe(eleves, notes, matieresForClasse, "T1", seuil);
  assert.equal(st.evalues, 2);
  assert.ok(Math.abs(st.moyenne - 7.5) < 1e-9); // (10 + 5) / 2
  assert.equal(st.admis, 1);                     // seul e1 (10) ≥ 10
  assert.equal(st.taux, 50);
});

test("statsParClasse : une entrée par classe", () => {
  const rows = statsParClasse(classes, eleves, notes, matieresForClasse, "T1", seuil);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].classe, "CM2");
  assert.equal(rows[0].taux, 50);
});

test("moyenneParMatiere : trié décroissant (dernière = en difficulté)", () => {
  const rows = moyenneParMatiere(eleves, notes, matieresForClasse, "T1");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].matiere, "Maths");      // (12 + 6) / 2 = 9
  assert.ok(Math.abs(rows[0].moyenne - 9) < 1e-9);
  assert.equal(rows[1].matiere, "Français");   // (8 + 4) / 2 = 6
  assert.ok(Math.abs(rows[1].moyenne - 6) < 1e-9);
});

test("statsGenre : filles vs garçons", () => {
  const g = statsGenre(eleves, notes, matieresForClasse, "T1", seuil);
  assert.equal(g.filles.evalues, 1);
  assert.equal(g.filles.taux, 100);            // e1 = 10 ≥ 10
  assert.equal(g.garcons.evalues, 1);
  assert.equal(g.garcons.taux, 0);             // e2 = 5 < 10
});

test("evolutionMoyenne : période sans note → moyenne null", () => {
  const evo = evolutionMoyenne(eleves, notes, matieresForClasse, ["T1", "T2"], seuil);
  assert.equal(evo.length, 2);
  assert.ok(Math.abs(evo[0].moyenne - 7.5) < 1e-9);
  assert.equal(evo[1].moyenne, null);          // T2 : aucune note
  assert.equal(evo[1].evalues, 0);
});

test("statsGroupe : élève sans note non compté (evalues)", () => {
  const elevesPlus = [...eleves, { _id: "e3", nom: "Sow", prenom: "F", classe: "CM2", sexe: "F", statut: "Actif" }];
  const st = statsGroupe(elevesPlus, notes, matieresForClasse, "T1", seuil);
  assert.equal(st.effectif, 3);
  assert.equal(st.evalues, 2); // e3 sans note → exclu du calcul
});
