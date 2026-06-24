// Grille de saisie du portail enseignant : mode multipériode (colonnes =
// périodes). Vérifie le préremplissage, la collecte avec la bonne période
// par cellule, et la rétrocompat du mode normal.
import test from "node:test";
import assert from "node:assert/strict";
import { construireGrille, collectGridNotes } from "../src/components/portail-enseignant/notes-grid.js";

const utilisateur = { section: "secondaire" };
const schoolInfo = {};
const eleves = [
  { _id: "e1", nom: "Diallo", prenom: "A", classe: "7ème" },
  { _id: "e2", nom: "Bah", prenom: "M", classe: "7ème" },
];
const mesNotes = [
  { _id: "n1", eleveId: "e1", periode: "T1", type: "Composition", note: 12 },
  { _id: "n2", eleveId: "e1", periode: "T2", type: "Composition", note: 14 },
];
const periodes = ["T1", "T2", "T3"];

test("multipériode : préremplit chaque (élève|période) et garde les noteId à la collecte", () => {
  const notes = construireGrille({
    classe: "7ème", type: "Composition", periodes, multiPeriode: true,
    eleves, mesNotes, schoolInfo, utilisateur,
  });
  assert.equal(notes["e1|T1"], "12");
  assert.equal(notes["e1|T2"], "14");
  assert.equal(notes["e1|T3"], "");
  assert.equal(notes["e2|T1"], "");

  // L'utilisateur saisit T3 pour e1 et T1 pour e2
  notes["e1|T3"] = "16";
  notes["e2|T1"] = "9";
  const { aSauver } = collectGridNotes({
    gridForm: { type: "Composition", multiPeriode: true, notes }, mesNotes, schoolInfo, utilisateur,
  });
  const parCle = Object.fromEntries(aSauver.map((x) => [`${x.eleveId}|${x.periode}`, x]));
  assert.equal(parCle["e1|T1"].noteId, "n1"); // existante → update
  assert.equal(parCle["e1|T3"].noteId, "");   // nouvelle
  assert.equal(parCle["e1|T3"].note, 16);
  assert.equal(parCle["e2|T1"].periode, "T1");
  assert.equal(parCle["e2|T1"].note, 9);
});

test("primaire : la grille cible la matière sélectionnée (notes par matière ne se mélangent pas)", () => {
  const ensPrimaire = { section: "primaire" };
  const elevesP = [{ _id: "e1", nom: "Diallo", prenom: "A", classe: "CM2" }];
  // Deux notes de la même période/type mais de matières différentes.
  const notesP = [
    { _id: "m1", eleveId: "e1", periode: "T1", type: "Composition", matiere: "Mathématiques", note: 8 },
    { _id: "m2", eleveId: "e1", periode: "T1", type: "Composition", matiere: "Français", note: 6 },
  ];
  // On ouvre la grille pour « Français » : on doit préremplir 6, pas 8.
  const grilleFr = construireGrille({
    classe: "CM2", type: "Composition", periode: "T1", matiere: "Français", multiPeriode: false,
    eleves: elevesP, mesNotes: notesP, schoolInfo, utilisateur: ensPrimaire,
  });
  assert.equal(grilleFr.e1, "6");

  // Collecte : la note existante ciblée est bien m2 (Français), pas m1.
  grilleFr.e1 = "7";
  const { aSauver } = collectGridNotes({
    gridForm: { type: "Composition", periode: "T1", matiere: "Français", multiPeriode: false, notes: grilleFr },
    mesNotes: notesP, schoolInfo, utilisateur: ensPrimaire,
  });
  const e1 = aSauver.find((x) => x.eleveId === "e1");
  assert.equal(e1.noteId, "m2");
  assert.equal(e1.matiere, "Français");
  assert.equal(e1.note, 7);
});

test("mode normal : clé = eleveId, période figée conservée", () => {
  const notes = construireGrille({
    classe: "7ème", type: "Composition", periode: "T1", multiPeriode: false,
    eleves, mesNotes, schoolInfo, utilisateur,
  });
  assert.equal(notes.e1, "12");
  assert.equal(notes.e2, "");
  notes.e2 = "8";
  const { aSauver } = collectGridNotes({
    gridForm: { type: "Composition", periode: "T1", multiPeriode: false, notes }, mesNotes, schoolInfo, utilisateur,
  });
  const e2 = aSauver.find((x) => x.eleveId === "e2");
  assert.equal(e2.periode, "T1");
  assert.equal(e2.note, 8);
});
