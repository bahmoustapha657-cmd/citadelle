// Le drapeau `avecEns` (« cette section gère des enseignants ») était employé
// comme discriminant de section : les modules Primaire ET Secondaire le
// passent à true, donc `avecEns ? "college" : "primaire"` valait TOUJOURS
// "college". Les bulletins, attestations et exports du primaire et du
// préscolaire partaient donc en « collège ».
//
// Ces tests fixent le contrat de la correction : c'est la SECTION réelle qui
// gouverne le calcul des moyennes et le code statistique officiel.
import test from "node:test";
import assert from "node:assert/strict";

import { getSubjectAverage, getGeneralAverage } from "../src/note-utils.js";
import { getCodeStatistique, mapNiveauToCycle } from "../src/legal-utils.js";
import { getSectionSlug } from "../src/constants.js";

// ── Cycle légal (pied de page officiel des bulletins/attestations) ─────────

test("mapNiveauToCycle accepte prescolaire comme alias de maternelle", () => {
  assert.equal(mapNiveauToCycle("prescolaire"), "maternelle");
  assert.equal(mapNiveauToCycle("maternelle"), "maternelle");
});

test("mapNiveauToCycle range primaire et secondaire dans leur cycle", () => {
  assert.equal(mapNiveauToCycle("primaire"), "primaire");
  assert.equal(mapNiveauToCycle("college"), "secondaire");
  assert.equal(mapNiveauToCycle("lycee"), "secondaire");
});

test("le code statistique imprimé suit la section, pas le repli secondaire", () => {
  // Profil réel de La Citadelle : trois codes distincts.
  const profil = {
    arreteOuverture: { numero: "A/2022/1065/MEPU-A/SGG", dateSignature: "2022-01-01" },
    codesStatistiques: { primaire: "541 10 13", maternelle: "541 10 16", secondaire: "954 17 12" },
  };

  assert.equal(getCodeStatistique(profil, mapNiveauToCycle("primaire")), "541 10 13");
  assert.equal(getCodeStatistique(profil, mapNiveauToCycle("prescolaire")), "541 10 16");
  assert.equal(getCodeStatistique(profil, mapNiveauToCycle("college")), "954 17 12");
});

// ── Calcul des moyennes ────────────────────────────────────────────────────

test("un niveau college imposé change la moyenne d'une matière du primaire", () => {
  // Le cas qui diverge : un devoir ET une composition sur la même matière,
  // sans note « Moyenne » saisie.
  const notes = [
    { type: "Devoir", note: 6, matiere: "Maths" },
    { type: "Composition", note: 9, matiere: "Maths" },
  ];

  // Formule du secondaire : (cours + 2 × composition) / 3.
  assert.equal(getSubjectAverage(notes, "3ème Année A", "college"), 8);
  // Primaire : moyenne arithmétique simple.
  assert.equal(getSubjectAverage(notes, "3ème Année A", "primaire"), 7.5);
});

test("le préscolaire garde la moyenne arithmétique du primaire", () => {
  const notes = [
    { type: "Devoir", note: 6, matiere: "Éveil" },
    { type: "Composition", note: 9, matiere: "Éveil" },
  ];

  assert.equal(getSubjectAverage(notes, "Petite Section", "prescolaire"), 7.5);
});

test("la pondération 2:1 des rubriques de Français reste réservée au collège", () => {
  const notes = [
    { type: "Dictee/Questions", note: 12, matiere: "Français" },
    { type: "Redaction", note: 6, matiere: "Français" },
  ];

  // Collège : (12 × 2 + 6 × 1) / 3 = 10.
  assert.equal(getSubjectAverage(notes, "8ème Année A", "college"), 10);
  // Primaire : moyenne simple = 9.
  assert.equal(getSubjectAverage(notes, "3ème Année A", "primaire"), 9);
});

test("sans niveau imposé, la section est déduite de la classe", () => {
  const notes = [
    { type: "Devoir", note: 6, matiere: "Maths" },
    { type: "Composition", note: 9, matiere: "Maths" },
  ];
  const matieres = [{ nom: "Maths", coefficient: 1 }];

  // Une classe de primaire ne doit jamais tomber sur la formule du secondaire.
  assert.equal(getGeneralAverage(notes, matieres, "3ème Année A"), 7.5);
  assert.equal(getGeneralAverage(notes, matieres, "3ème Année A", "primaire"), 7.5);
  // Et la classe de collège homonyme (« 8ème Année ») garde la sienne.
  assert.equal(getGeneralAverage(notes, matieres, "8ème Année A"), 8);
});

// ── Nom de fichier des exports Excel ───────────────────────────────────────

test("getSectionSlug nomme les exports sans accent, par section", () => {
  assert.equal(getSectionSlug("prescolaire"), "Prescolaire");
  assert.equal(getSectionSlug("primaire"), "Primaire");
  assert.equal(getSectionSlug("college"), "College");
  assert.equal(getSectionSlug("lycee"), "Lycee");
});
