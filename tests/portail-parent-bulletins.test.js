import { test } from "node:test";
import assert from "node:assert/strict";

import { getBaremeForSection, SECTIONS_ECOLE } from "../src/constants.js";
import { mapNiveauToCycle } from "../src/legal-utils.js";
import { computeBulletinModel } from "../src/reports/bulletins/bulletin-page-data.js";
import { computeBulletinPeriode, sectionDeLEleve } from "../src/components/portail-parent/portail-parent-derive.js";

// Ce que le portail parent transmet à imprimerBulletin, rejoué sur le modèle
// pur du bulletin imprimé (niveau = section, barème = maxNote).
const modeleImprime = (eleve, notesPeriode, periode, section) => {
  const { matieres, maxNote } = computeBulletinPeriode(notesPeriode, eleve, section);
  return computeBulletinModel({
    eleve, notes: notesPeriode, matieres, periode, niveau: section, maxNote, schoolInfo: {}, annee: "2025-2026",
  });
};

// ── Barème par section ───────────────────────────────────────────────────
test("la maternelle et le primaire sont notés sur 10, le secondaire sur 20", () => {
  assert.equal(getBaremeForSection("prescolaire"), 10);
  assert.equal(getBaremeForSection("primaire"), 10);
  assert.equal(getBaremeForSection("college"), 20);
  assert.equal(getBaremeForSection("lycee"), 20);
});

test("barème : une section inconnue ou absente suit le secondaire", () => {
  assert.equal(getBaremeForSection(), 20);
  assert.equal(getBaremeForSection(""), 20);
  assert.equal(getBaremeForSection(null), 20);
  assert.equal(getBaremeForSection("inconnue"), 20);
});

test("barème : chaque section de l'école a un barème de 10 ou 20", () => {
  for (const section of SECTIONS_ECOLE) {
    assert.ok([10, 20].includes(getBaremeForSection(section)), section);
  }
});

// ── Section de l'enfant ──────────────────────────────────────────────────
test("section de l'enfant : la colonne section de sa fiche prime", () => {
  assert.equal(sectionDeLEleve({ section: "prescolaire", classe: "Petite Section A" }), "prescolaire");
  // Nom de classe hors motif : la section stockée évite le repli « college ».
  assert.equal(sectionDeLEleve({ section: "prescolaire", classe: "Crèche A" }), "prescolaire");
});

test("section de l'enfant : sans section stockée, on la déduit de la classe", () => {
  assert.equal(sectionDeLEleve({ classe: "Grande Section B" }), "prescolaire");
  assert.equal(sectionDeLEleve({ classe: "CM2 A" }), "primaire");
  assert.equal(sectionDeLEleve({ classe: "Terminale C" }), "lycee");
  assert.equal(sectionDeLEleve({}), "college");
  assert.equal(sectionDeLEleve(), "college");
});

// ── Bulletin d'une période ───────────────────────────────────────────────
const maternelle = { _id: "e1", nom: "Bah", prenom: "Awa", classe: "Petite Section A", section: "prescolaire" };
const notesMaternelle = [
  { eleveId: "e1", periode: "T1", matiere: "Langage", type: "Evaluation", note: 8 },
  { eleveId: "e1", periode: "T1", matiere: "Graphisme", type: "Evaluation", note: 9 },
];

test("bulletin de maternelle : barème 10 et moyenne sur 10", () => {
  const section = sectionDeLEleve(maternelle);
  const bulletin = computeBulletinPeriode(notesMaternelle, maternelle, section);
  assert.equal(bulletin.maxNote, 10);
  assert.equal(bulletin.moyenne, 8.5);
  assert.deepEqual(bulletin.matieres, [{ nom: "Langage" }, { nom: "Graphisme" }]);
});

test("bulletin de maternelle imprimé : même moyenne, mention sur 10, cycle maternelle", () => {
  const section = sectionDeLEleve(maternelle);
  const modele = modeleImprime(maternelle, notesMaternelle, "T1", section);
  assert.equal(modele.moyGene, "8.50");
  // 8,5/10 : « Très Bien ». Sur 20 (ancien appel), c'était « Insuffisant ».
  assert.equal(modele.mention, "Très Bien");
  // La clé de section (et non le libellé « Secondaire ») donne le code
  // statistique de la maternelle au pied du bulletin.
  assert.equal(mapNiveauToCycle(section), "maternelle");
});

test("bulletin du primaire : barème 10", () => {
  const eleve = { _id: "e2", classe: "CM2 A", section: "primaire" };
  const notes = [{ eleveId: "e2", periode: "T1", matiere: "Calcul", type: "Devoir", note: 6 }];
  const bulletin = computeBulletinPeriode(notes, eleve, sectionDeLEleve(eleve));
  assert.equal(bulletin.maxNote, 10);
  assert.equal(bulletin.moyenne, 6);
});

test("bulletin du collège : formule du secondaire, identique à l'écran et à l'impression", () => {
  const eleve = { _id: "e3", classe: "7ème Année A", section: "college" };
  const notes = [
    { eleveId: "e3", periode: "T1", matiere: "Maths", type: "Devoir", note: 8 },
    { eleveId: "e3", periode: "T1", matiere: "Maths", type: "Composition", note: 14 },
  ];
  const section = sectionDeLEleve(eleve);
  const bulletin = computeBulletinPeriode(notes, eleve, section);
  assert.equal(bulletin.maxNote, 20);
  // (cours + 2 × compo) / 3 = (8 + 28) / 3 = 12 — et non la moyenne simple
  // (11) que produisait l'ancien niveau « Secondaire ».
  assert.equal(bulletin.moyenne, 12);
  assert.equal(modeleImprime(eleve, notes, "T1", section).moyGene, "12.00");
});

test("classe hors motif : la moyenne affichée suit la section de la fiche, comme l'impression", () => {
  // « Crèche A » n'est pas reconnue par getSectionForClasse (repli « college ») :
  // déduite de la classe, la moyenne prendrait la formule du secondaire (6).
  const eleve = { _id: "e4", classe: "Crèche A", section: "prescolaire" };
  const notes = [
    { eleveId: "e4", periode: "T1", matiere: "Langage", type: "Devoir", note: 4 },
    { eleveId: "e4", periode: "T1", matiere: "Langage", type: "Composition", note: 7 },
  ];
  const section = sectionDeLEleve(eleve);
  const bulletin = computeBulletinPeriode(notes, eleve, section);
  assert.equal(bulletin.maxNote, 10);
  assert.equal(bulletin.moyenne, 5.5);
  assert.equal(modeleImprime(eleve, notes, "T1", section).moyGene, "5.50");
});
