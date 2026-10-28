// Tableau d'honneur PAR CLASSE : lauréats de chaque classe, mêmes moyennes et
// rangs que le bulletin. Une seule note « Devoir » par matière → la moyenne de
// matière vaut la note, quelle que soit la section : attentes déterministes.
import test from "node:test";
import assert from "node:assert/strict";
import {
  periodeHonneurParDefaut, tableauHonneurSection, tableauxHonneurParClasse,
} from "../src/components/ecole/honneur-tab/classement-honneur.js";
import { PERIODE_ANNEE } from "../src/reports/bulletins/annual-notes.js";
import { getRangEleve } from "../src/reports/bulletins/bulletin-helpers.js";

const matieres = [{ nom: "Maths", coefficient: 1 }, { nom: "Français", coefficient: 1 }];
const matieresForClasse = () => matieres;
const eleve = (_id, classe, extra = {}) => ({ _id, nom: _id.toUpperCase(), prenom: "P", classe, statut: "Actif", ...extra });
// Deux notes (Maths, Français) par élève et par période.
const notesDe = (eleveId, periode, maths, francais) => [
  { eleveId, periode, matiere: "Maths", type: "Devoir", note: maths },
  { eleveId, periode, matiere: "Français", type: "Devoir", note: francais },
];

const eleves = [
  eleve("a1", "7ème Année A"), eleve("a2", "7ème Année A"), eleve("a3", "7ème Année A"), eleve("a4", "7ème Année A"),
  eleve("b1", "10ème Année"), eleve("b2", "10ème Année"),
];
const notes = [
  ...notesDe("a1", "T1", 16, 14), // 15
  ...notesDe("a2", "T1", 12, 12), // 12
  ...notesDe("a3", "T1", 12, 12), // 12 (ex aequo avec a2)
  ...notesDe("a4", "T1", 8, 6),   // 7
  ...notesDe("b1", "T1", 18, 18), // 18
  ...notesDe("b2", "T1", 10, 12), // 11
  ...notesDe("a1", "T2", 4, 6),   // T2 : ne doit pas peser sur le T1
];
const base = { eleves, notes, matieresForClasse, periodes: ["T1", "T2", "T3"], section: "college", maxNote: 20 };
const ids = (laureats) => laureats.map((e) => e._id);

test("une entrée par classe, dans l'ordre des niveaux (7ème avant 10ème)", () => {
  const tb = tableauxHonneurParClasse({ ...base, periode: "T1", nombre: 5, seuil: "aucun" });
  assert.deepEqual(tb.map((t) => t.classe), ["7ème Année A", "10ème Année"]);
  // Chaque classe a ses propres premiers : le 18 de 10ème ne prive pas la 7ème.
  assert.deepEqual(ids(tb[0].laureats), ["a1", "a2", "a3", "a4"]);
  assert.deepEqual(ids(tb[1].laureats), ["b1", "b2"]);
});

test("rangs ex aequo : deux élèves à la même moyenne partagent le rang", () => {
  const [classeA] = tableauxHonneurParClasse({ ...base, periode: "T1", nombre: 5, seuil: "aucun" });
  assert.deepEqual(classeA.laureats.map((e) => e.rang), [1, 2, 2, 4]);
  assert.equal(classeA.laureats[0].moyenne, 15);
});

test("les rangs sont ceux du bulletin (getRangEleve)", () => {
  const [classeA] = tableauxHonneurParClasse({ ...base, periode: "T1", nombre: 10, seuil: "aucun" });
  const elevesA = eleves.filter((e) => e.classe === "7ème Année A");
  for (const laureat of classeA.laureats) {
    const rangBulletin = getRangEleve(laureat, elevesA, notes, matieres, "T1", "7ème Année A", "college");
    assert.equal(laureat.rang, rangBulletin.rang, laureat._id);
  }
});

test("un ex aequo au dernier rang retenu entre aussi", () => {
  const [classeA] = tableauxHonneurParClasse({ ...base, periode: "T1", nombre: 2, seuil: "aucun" });
  assert.deepEqual(ids(classeA.laureats), ["a1", "a2", "a3"]);
});

test("la moyenne minimale écarte les élèves sous le seuil (part du barème)", () => {
  const [classeA, classeB] = tableauxHonneurParClasse({ ...base, periode: "T1", nombre: 10, seuil: "passable" });
  assert.deepEqual(ids(classeA.laureats), ["a1", "a2", "a3"]); // a4 (7/20) écarté
  assert.deepEqual(ids(classeB.laureats), ["b1", "b2"]);
  assert.equal(classeA.evalues, 4); // il reste compté parmi les classés
  // Primaire noté sur 10 : « Bien » = 7/10, pas 14.
  const primaire = tableauxHonneurParClasse({
    ...base, section: "primaire", maxNote: 10, periode: "T1", nombre: 10, seuil: "bien",
    eleves: [eleve("p1", "CM2"), eleve("p2", "CM2")],
    notes: [...notesDe("p1", "T1", 8, 8), ...notesDe("p2", "T1", 6, 6)],
  });
  assert.deepEqual(ids(primaire[0].laureats), ["p1"]);
});

test("une seule période à la fois : les notes du T2 ne comptent pas au T1", () => {
  const [classeA] = tableauxHonneurParClasse({ ...base, periode: "T2", nombre: 5, seuil: "aucun" });
  assert.deepEqual(ids(classeA.laureats), ["a1"]);
  assert.equal(classeA.laureats[0].moyenne, 5);
  assert.equal(classeA.evalues, 1); // les autres n'ont pas de note au T2
});

test("année : moyenne des périodes, diviseur fixe (comme le bulletin annuel)", () => {
  const [classeA] = tableauxHonneurParClasse({ ...base, periode: PERIODE_ANNEE, nombre: 1, seuil: "aucun" });
  // a1 : (15 + 5 + 0) / 3 ≈ 6,67 ; a2 et a3 : 12 / 3 = 4 → a1 premier.
  assert.deepEqual(ids(classeA.laureats), ["a1"]);
  assert.ok(Math.abs(classeA.laureats[0].moyenne - 20 / 3) < 1e-9);
});

test("élève parti : gardé s'il a des notes sur la période, sinon écarté", () => {
  const parti = eleve("a5", "7ème Année A", { statut: "Transféré" });
  const tbT1 = tableauxHonneurParClasse({
    ...base, eleves: [...eleves, parti], notes: [...notes, ...notesDe("a5", "T1", 20, 20)],
    periode: "T1", nombre: 1, seuil: "aucun",
  });
  assert.deepEqual(ids(tbT1[0].laureats), ["a5"]);
  const tbSansNote = tableauxHonneurParClasse({ ...base, eleves: [...eleves, parti], periode: "T1", nombre: 5, seuil: "aucun" });
  assert.equal(tbSansNote[0].effectif, 4);
});

test("une classe sans note figure quand même, vide", () => {
  const tb = tableauxHonneurParClasse({ ...base, periode: "T1", nombre: 5, seuil: "aucun", classes: ["8ème Année"] });
  const huitieme = tb.find((t) => t.classe === "8ème Année");
  assert.ok(huitieme);
  assert.equal(huitieme.evalues, 0);
  assert.deepEqual(huitieme.laureats, []);
  assert.deepEqual(tb.map((t) => t.classe), ["7ème Année A", "8ème Année", "10ème Année"]);
});

test("palmarès de la section : toutes classes confondues", () => {
  const { laureats } = tableauHonneurSection({ ...base, periode: "T1", nombre: 3, seuil: "aucun" });
  assert.deepEqual(ids(laureats), ["b1", "a1", "a2", "a3"]); // 18, 15, 12, 12 (ex aequo au 3e rang)
  assert.deepEqual(laureats.map((e) => e.rang), [1, 2, 3, 3]);
});

test("période par défaut : la dernière qui a des notes", () => {
  assert.equal(periodeHonneurParDefaut(notes, ["T1", "T2", "T3"]), "T2");
  assert.equal(periodeHonneurParDefaut([], ["T1", "T2", "T3"]), "T1");
  assert.equal(periodeHonneurParDefaut([], []), PERIODE_ANNEE);
});
