// Modèles complets de bulletin (Officiel, Prestige, Contemporain) : détail
// note de classe / composition, rang et professeur par matière, assiduité,
// total des points, distinction — et leur rendu HTML.
import test from "node:test";
import assert from "node:assert/strict";

import { getGeneralAverage, getSubjectAverage, getSubjectParts } from "../src/note-utils.ts";
import { assiduiteEleve } from "../src/absences-eleves.js";
import {
  getMoyennesPeriodes, getProfesseursParMatiere, getRangsParMatiere,
} from "../src/reports/bulletins/bulletin-helpers.js";
import { computeBulletinProModel, getDistinction } from "../src/reports/bulletins/bulletin-pro-data.js";
import { buildBulletinPageHTML, estModeleComplet, getBulletinStyles } from "../src/reports/bulletins/bulletin-page.js";
import { PERIODE_ANNEE } from "../src/reports/bulletins/annual-notes.js";
import { libellePeriode, nb, ordinal } from "../src/reports/bulletins/bulletin-pro-commun.js";

// getAnnee() lit l'année consultée dans localStorage.
globalThis.localStorage ??= { getItem: () => "2026-2027", setItem() {}, removeItem() {} };

const n = (eleveId, matiere, type, note, periode = "T1", enseignantNom = "") =>
  ({ eleveId, matiere, type, note, periode, enseignantNom });

// ── Détail note de classe / composition ──────────────────────────────────
test("secondaire : note de classe et composition se recombinent en la moyenne de la matière", () => {
  const notes = [n("e", "Maths", "Interrogation", 12), n("e", "Maths", "Devoir", 14), n("e", "Maths", "Composition", 16)];
  const parts = getSubjectParts(notes, "", "college");
  assert.equal(parts.cours, 13);
  assert.equal(parts.composition, 16);
  assert.equal((parts.cours + 2 * parts.composition) / 3, getSubjectAverage(notes, "", "college"));
});

test("pas de détail quand la moyenne ne se décompose pas en classe + composition", () => {
  const simple = [n("e", "Calcul", "Devoir", 7), n("e", "Calcul", "Composition", 8)];
  assert.equal(getSubjectParts(simple, "", "primaire"), null);
  assert.equal(getSubjectParts(simple, "", "prescolaire"), null);
  // Moyenne saisie directement : elle prime, rien à détailler.
  assert.equal(getSubjectParts([...simple, n("e", "Calcul", "Moyenne", 9)], "", "college"), null);
  // Rubriques du Français au collège.
  assert.equal(getSubjectParts([n("e", "Français", "Rédaction", 12), n("e", "Français", "Composition", 14)], "", "college"), null);
});

// ── Assiduité ────────────────────────────────────────────────────────────
test("assiduité : absences justifiées, non justifiées et retards de l'année scolaire", () => {
  const absences = [
    { eleveId: "e", type: "Absence", justifie: "Oui", date: "2026-10-03" },
    { eleveId: "e", type: "Absence", justifie: "Non", date: "2026-11-12" },
    { eleveId: "e", type: "Absence", date: "15/01/2027" }, // ancienne saisie, sans « justifié »
    { eleveId: "e", type: "Retard", justifie: "Non", date: "2027-02-01" },
    { eleveId: "e", type: "Sanction", date: "2027-02-02" },
    { eleveId: "e", type: "Absence", justifie: "Non", date: "2026-05-20" }, // année précédente
    { eleveId: "autre", type: "Absence", justifie: "Non", date: "2026-10-03" },
  ];
  assert.deepEqual(assiduiteEleve(absences, "e", "2026-2027"), { absJ: 1, absNJ: 2, retards: 1 });
  assert.deepEqual(assiduiteEleve([], "e", "2026-2027"), { absJ: 0, absNJ: 0, retards: 0 });
});

// ── Rang, professeur et moyennes par période ─────────────────────────────
test("rang par matière : ex aequo au même rang, sans note non classé", () => {
  const eleves = [{ _id: "a" }, { _id: "b" }, { _id: "c" }, { _id: "d" }];
  const notes = [n("a", "Maths", "Devoir", 15), n("b", "Maths", "Devoir", 17), n("c", "Maths", "Devoir", 15)];
  const rangs = getRangsParMatiere(eleves, notes, [{ nom: "Maths" }], "T1", "", "primaire").get("Maths");
  assert.equal(rangs.get("b"), 1);
  assert.equal(rangs.get("a"), 2);
  assert.equal(rangs.get("c"), 2);
  assert.equal(rangs.has("d"), false);
});

test("professeur : l'emploi du temps fait foi, sinon celui qui a saisi le plus de notes", () => {
  const matieres = [{ nom: "Maths" }, { nom: "Anglais" }, { nom: "EPS" }];
  const notes = [
    n("a", "Maths", "Devoir", 12, "T1", "M. Barry"), n("b", "Maths", "Devoir", 12, "T1", "M. Barry"),
    n("a", "Maths", "Devoir", 12, "T1", "Direction"),
    n("a", "Anglais", "Devoir", 12, "T1", "Mme Condé"),
    n("z", "EPS", "Devoir", 12, "T1", "M. Intrus"), // élève d'une autre classe
  ];
  const emplois = [{ classe: "7A", matiere: "Anglais", enseignant: "M. Touré" }, { classe: "8A", matiere: "Maths", enseignant: "Autre" }];
  const profs = getProfesseursParMatiere({ classe: "7A", matieres, eleveIds: ["a", "b"], notes, periode: "T1", emplois });
  assert.equal(profs.get("Maths"), "M. Barry");
  assert.equal(profs.get("Anglais"), "M. Touré");
  assert.equal(profs.has("EPS"), false);
});

test("moyennes par période : une période sans note reste vide, pas à zéro", () => {
  const notes = [n("e", "Maths", "Devoir", 12, "T1"), n("e", "Maths", "Devoir", 15, "T2")];
  const moyennes = getMoyennesPeriodes({ _id: "e" }, notes, [{ nom: "Maths", coefficient: 1 }], "", "primaire", ["T1", "T2", "T3"]);
  assert.deepEqual(moyennes, [{ periode: "T1", moy: 12 }, { periode: "T2", moy: 15 }, { periode: "T3", moy: null }]);
});

// ── Modèle de données ────────────────────────────────────────────────────
const matieres = [
  { nom: "Maths", coefficient: 4 }, { nom: "Anglais", coefficient: 2 },
  { nom: "SVT", coefficient: 2 }, { nom: "Vocabulaire", coefficient: 1, nature: "rubrique" },
];
const eleve = { _id: "e", nom: "DIALLO", prenom: "Mariama", sexe: "F", classe: "7ème A" };
const notesEleve = [
  n("e", "Maths", "Devoir", 14), n("e", "Maths", "Composition", 17),
  n("e", "Anglais", "Interrogation", 12), n("e", "Anglais", "Composition", 15),
];

test("modèle complet : total des points cohérent avec la moyenne générale, rubrique absente", () => {
  const m = computeBulletinProModel({ eleve, notes: notesEleve, matieres, periode: "T1", niveau: "college", maxNote: 20, schoolInfo: {}, annee: "2026-2027" });
  assert.deepEqual(m.lignes.map((l) => l.mat), ["Maths", "Anglais", "SVT"]);
  assert.equal(m.totalCoef, 8);
  assert.equal(m.totalMax, 160);
  assert.ok(Math.abs(m.totalPts / m.totalCoef - m.moyGene) < 1e-9);
  assert.ok(Math.abs(m.moyGene - getGeneralAverage(notesEleve, matieres, eleve.classe, "college")) < 1e-9);
  // SVT sans note : comptée 0 à son coefficient, comme la moyenne générale.
  assert.equal(m.lignes[2].moy, null);
  assert.equal(m.lignes[2].pts, null);
  assert.equal(m.lignes[0].cours, 14);
  assert.equal(m.lignes[0].compo, 17);
  assert.equal(m.avecDetail, true);
  assert.equal(m.avecRang, false);
});

test("bulletin annuel : pas de détail classe / composition (notes synthétiques)", () => {
  const annuelles = [n("e", "Maths", "Composition", 15, PERIODE_ANNEE)];
  const m = computeBulletinProModel({ eleve, notes: annuelles, matieres, periode: PERIODE_ANNEE, niveau: "college", maxNote: 20, schoolInfo: {}, annee: "2026-2027" });
  assert.equal(m.avecDetail, false);
  assert.equal(m.lignes[0].moy, 15);
});

test("distinction proposée selon le barème : sur 20 comme sur 10, jamais de sanction", () => {
  assert.equal(getDistinction(16.5, 20), "felicitations");
  assert.equal(getDistinction(14, 20), "honneur");
  assert.equal(getDistinction(12.2, 20), "encouragements");
  assert.equal(getDistinction(11.9, 20), null);
  assert.equal(getDistinction(7.2, 10), "honneur");
  assert.equal(getDistinction(null, 20), null);
});

test("formats : virgule décimale, 1re pour une élève, libellé de période", () => {
  assert.equal(nb(15.444), "15,44");
  assert.equal(nb(null), "—");
  assert.equal(ordinal(1, "F"), "1<sup>re</sup>");
  assert.equal(ordinal(1, "M"), "1<sup>er</sup>");
  assert.equal(ordinal(5), "5<sup>e</sup>");
  assert.equal(libellePeriode("T2"), "Deuxième trimestre");
  assert.equal(libellePeriode("Octobre"), "Mois d'octobre");
  assert.equal(libellePeriode("Mars"), "Mois de mars");
  assert.equal(libellePeriode(PERIODE_ANNEE), "Fin d'année");
});

// ── Rendu ────────────────────────────────────────────────────────────────
const rendu = (modeleBulletin, extra = {}) => buildBulletinPageHTML({
  eleve: { ...eleve, nom: "DIALLO <b>", filiation: "Fille de Mamadou" },
  notes: notesEleve, matieres, periode: "T1", niveau: "college", maxNote: 20,
  schoolInfo: { nom: "La Citadelle", ville: "Conakry", modeleBulletin, signatures: {} },
  rang: { rang: 1, effectif: 30 },
  classStats: { effectif: 30, moyenneClasse: 11.2, min: 6, max: 17 },
  assiduite: { absJ: 2, absNJ: 1, retards: 3 },
  appreciation: "Très bon travail",
  ...extra,
});

for (const modele of ["officiel", "prestige", "contemporain"]) {
  test(`rendu « ${modele} » : en-tête, totaux, assiduité, signatures, noms échappés`, () => {
    assert.equal(estModeleComplet({ modeleBulletin: modele }), true);
    const html = rendu(modele);
    assert.match(html, /class="page pro/);
    assert.match(html, /La Citadelle/);
    assert.match(html, /Fait à Conakry/);
    assert.match(html, /sur 160/);
    assert.match(html, /1<sup>re<\/sup>/);
    assert.match(html, /Très bon travail/);
    assert.match(html, /Le Professeur principal/);
    assert.ok(!html.includes("DIALLO <b>"), "le nom doit être échappé");
    assert.match(html, /DIALLO &lt;b&gt;/);
    assert.match(getBulletinStyles(modele), new RegExp(`\\.${{ officiel: "bo", prestige: "bp", contemporain: "bc" }[modele]}\\b`));
  });
}

test("rendu officiel : colonnes de rang et de professeur seulement quand elles sont connues", () => {
  const sans = rendu("officiel");
  assert.ok(!sans.includes(">Rang</th>"));
  assert.ok(!sans.includes(">Professeur</th>"));
  const avec = rendu("officiel", {
    // SVT notée : moyenne générale 15 (Bien).
    notes: [...notesEleve, n("e", "SVT", "Devoir", 14), n("e", "SVT", "Composition", 14)],
    rangsParMatiere: new Map([["Maths", new Map([["e", 3]])]]),
    professeurs: new Map([["Maths", "M. Barry"]]),
  });
  assert.match(avec, />Rang<\/th>/);
  assert.match(avec, /M\. Barry/);
  // Bien de moyenne générale → tableau d'honneur coché.
  assert.match(avec, /<i>✕<\/i><b>Tableau d'honneur<\/b>/);
});

test("rendu sans absences connues : cases d'assiduité à remplir à la main", () => {
  assert.match(rendu("officiel", { assiduite: null }), /Absences justifiées<\/span><b>……<\/b>/);
});

test("les modèles historiques ne changent pas", () => {
  for (const modele of ["classique", "compact", "moderne"]) {
    assert.equal(estModeleComplet({ modeleBulletin: modele }), false);
    assert.ok(!rendu(modele).includes("page pro"));
  }
  assert.equal(estModeleComplet({}), false);
});
