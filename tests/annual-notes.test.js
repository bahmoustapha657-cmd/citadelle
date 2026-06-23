// Vérifie que la moyenne générale ANNUELLE calculée via les notes annuelles
// synthétiques est identique à la moyenne des moyennes générales des périodes
// ((genT1+genT2+genT3)/3) — l'égalité algébrique qui justifie l'approche.
import test from "node:test";
import assert from "node:assert/strict";
import { buildBulletinNotesAnnuelles } from "../src/reports/bulletins/annual-notes.js";
import { getGeneralAverage } from "../src/note-utils.js";

test("moyenne générale annuelle (synthétique) = moyenne des moyennes générales périodiques", () => {
  const classe = "7ème Année A"; // secondaire
  const niveau = "secondaire";
  const periodes = ["T1", "T2", "T3"];
  const eleves = [{ _id: "e1", nom: "Diallo", prenom: "Aïssatou", classe }];
  const matieres = [{ nom: "Maths", coefficient: 2 }, { nom: "Français", coefficient: 1 }];
  const matsFor = () => matieres;

  // Compositions par (matière, période)
  const n = (matiere, periode, note) => ({ eleveId: "e1", eleveNom: "Diallo Aïssatou", matiere, periode, type: "Composition", note });
  const notes = [
    n("Maths", "T1", 12), n("Maths", "T2", 14), n("Maths", "T3", 16),
    n("Français", "T1", 10), n("Français", "T2", 10), n("Français", "T3", 10),
  ];

  // Moyenne générale de chaque période, puis leur moyenne arithmétique.
  const genParPeriode = periodes.map((p) =>
    getGeneralAverage(notes.filter((x) => x.periode === p), matieres, classe, niveau));
  const moyDesGenerales = genParPeriode.reduce((s, v) => s + v, 0) / periodes.length;

  // Moyenne générale annuelle via notes synthétiques.
  const notesAnnuelles = buildBulletinNotesAnnuelles({ eleves, notes, matsFor, periodes, niveau });
  const genAnnuelle = getGeneralAverage(notesAnnuelles, matieres, classe, niveau);

  assert.ok(Math.abs(genAnnuelle - moyDesGenerales) < 1e-9,
    `annuelle ${genAnnuelle} ≠ moyenne des générales ${moyDesGenerales}`);
  // Valeur attendue : (28+10)/3 = 12.6667
  assert.ok(Math.abs(genAnnuelle - 38 / 3) < 1e-9);
});

test("matière non notée sur une période → comptée 0 (diviseur = nb périodes)", () => {
  const classe = "7ème Année A";
  const niveau = "secondaire";
  const periodes = ["T1", "T2", "T3"];
  const eleves = [{ _id: "e1", nom: "Bah", prenom: "Mamadou", classe }];
  const matieres = [{ nom: "Maths", coefficient: 1 }];
  const matsFor = () => matieres;
  // Maths notée seulement en T1 et T2 (T3 absent → 0)
  const notes = [
    { eleveId: "e1", eleveNom: "Bah Mamadou", matiere: "Maths", periode: "T1", type: "Composition", note: 12 },
    { eleveId: "e1", eleveNom: "Bah Mamadou", matiere: "Maths", periode: "T2", type: "Composition", note: 15 },
  ];
  const [synth] = buildBulletinNotesAnnuelles({ eleves, notes, matsFor, periodes, niveau });
  // (12 + 15 + 0) / 3 = 9
  assert.equal(synth.note, 9);
});
