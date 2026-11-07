// Règle accordée le 2026-11-02 : une matière que personne n'a notée dans la
// classe pour la période ne compte pas dans la moyenne générale ; notée pour
// un camarade, elle compte 0 pour l'élève qui n'a rien.
import test from "node:test";
import assert from "node:assert/strict";
import { getGeneralAverage, matieresNotees } from "../src/note-utils.js";
import {
  creerMatieresComptees,
  getMoyennesPeriodes,
  getRangEleve,
  getStatsClasse,
} from "../src/reports/bulletins/bulletin-helpers.js";
import { getMoyenneAnnuelleEleve } from "../src/reports/attestation/attestation-moyenne.js";

const classe = "3ème Année A";
const matieres = [
  { nom: "Calcul", coefficient: 2 },
  { nom: "Lecture", coefficient: 1 },
  { nom: "Mesure", coefficient: 1 }, // créée en cours d'année, jamais notée
];
const eleves = [
  { _id: "a", classe },
  { _id: "b", classe },
];
const note = (eleveId, matiere, valeur, periode = "T1") => ({ eleveId, matiere, periode, type: "Composition", note: valeur });

test("matieresNotees : garde les matières notées pour au moins un élève", () => {
  const notes = [note("a", "Calcul", 8), note("b", "Lecture", 6), note("b", "Mesure", "")];
  assert.deepEqual(matieresNotees(matieres, notes).map((m) => m.nom), ["Calcul", "Lecture"],
    "une note vide ne fait pas d'une matière une matière notée");
});

test("bulletin : la matière jamais notée sort du dénominateur, rang et stats suivent", () => {
  const notes = [note("a", "Calcul", 8), note("a", "Lecture", 6), note("b", "Calcul", 5), note("b", "Lecture", 9)];
  // a : (8×2 + 6) / 3 ; sans la règle, /4 avec Mesure à 0.
  const stats = getStatsClasse(eleves, notes, matieres, "T1", classe, "primaire");
  assert.ok(Math.abs(stats.max - 22 / 3) < 1e-9, `obtenu ${stats.max}`);
  assert.deepEqual(getRangEleve(eleves[0], eleves, notes, matieres, "T1", classe, "primaire"), { rang: 1, effectif: 2 });
});

test("matière notée pour un camarade : 0 pour qui n'a rien", () => {
  const notes = [note("a", "Calcul", 8), note("a", "Lecture", 6), note("b", "Mesure", 10)];
  const comptees = creerMatieresComptees({ eleves, notes, periode: "T1", matieresForClasse: () => matieres });
  assert.deepEqual(comptees(classe).map((m) => m.nom), ["Calcul", "Lecture", "Mesure"]);
  const moyA = getGeneralAverage(notes.filter((n) => n.eleveId === "a"), comptees(classe), classe, "primaire");
  assert.ok(Math.abs(moyA - 22 / 4) < 1e-9, `obtenu ${moyA}`);
});

test("creerMatieresComptees : jugé par classe et par période", () => {
  const autre = { _id: "c", classe: "4ème Année A" };
  const notes = [note("a", "Calcul", 8), note("c", "Mesure", 7), note("a", "Lecture", 6, "T2")];
  const comptees = creerMatieresComptees({ eleves: [...eleves, autre], notes, periode: "T1", matieresForClasse: () => matieres });
  assert.deepEqual(comptees(classe).map((m) => m.nom), ["Calcul"], "Mesure notée dans une AUTRE classe ; Lecture en T2");
  assert.deepEqual(comptees("4ème Année A").map((m) => m.nom), ["Mesure"]);
  assert.deepEqual(comptees("5ème Année A"), [], "classe sans note : aucune matière, donc pas de moyenne");
});

test("courbe des périodes : chaque période compte SES matières notées", () => {
  const notes = [note("a", "Calcul", 8, "T1"), note("a", "Calcul", 6, "T2"), note("b", "Lecture", 9, "T2")];
  const [t1, t2] = getMoyennesPeriodes(eleves[0], notes, matieres, classe, "primaire", ["T1", "T2"], eleves);
  assert.equal(t1.moy, 8, "T1 : seul Calcul a été noté dans la classe");
  assert.ok(Math.abs(t2.moy - 12 / 3) < 1e-9, `T2 : Calcul et Lecture comptent, obtenu ${t2.moy}`);
});

test("attestation : même règle avec les camarades de l'année", () => {
  const notes = [note("a", "Calcul", 8), note("a", "Lecture", 6)];
  const commun = { eleve: eleves[0], notes, matieres, periodes: ["T1"], niveau: "primaire" };
  const avec = getMoyenneAnnuelleEleve({ ...commun, camarades: eleves });
  assert.ok(Math.abs(avec - 22 / 3) < 1e-9, `obtenu ${avec}`);
  const sans = getMoyenneAnnuelleEleve(commun);
  assert.ok(Math.abs(sans - 22 / 4) < 1e-9, "sans les camarades : toutes les matières, comme avant");
});
