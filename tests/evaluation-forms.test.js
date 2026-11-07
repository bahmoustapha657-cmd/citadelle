import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveExamForms,
  getActiveNoteForms,
  getAvertissementSaisie,
  getEffetForme,
  getEvaluationFormsConfig,
  getEvaluationLabel,
  resolveCanonicalExamType,
  resolveCanonicalNoteType,
} from "../src/evaluation-forms.js";

test("getActiveNoteForms retourne les formes actives configurees par l'ecole", () => {
  const schoolInfo = {
    evaluationForms: {
      secondaire: [
        { id: "devoir", label: "Test ecrit", active: true },
        { id: "interrogation", label: "Oral", active: false },
        { id: "examen", label: "Examen", active: false },
        { id: "composition", label: "Compo", active: true },
      ],
    },
  };

  const forms = getActiveNoteForms(schoolInfo, "secondaire");

  // Les formes par défaut ajoutent aussi "Évaluation orale", "Évaluation
  // écrite" et "Moyenne de la matière" (actives par défaut, non surchargées
  // par schoolInfo).
  assert.deepEqual(forms.map((item) => item.label), ["Test ecrit", "Évaluation orale", "Évaluation écrite", "Compo", "Moyenne de la matière"]);
  assert.deepEqual(forms.map((item) => item.value), ["Devoir", "Évaluation orale", "Évaluation écrite", "Composition", "Moyenne"]);
});

test("resolveCanonicalNoteType reconnait un libelle personnalise", () => {
  const schoolInfo = {
    evaluationForms: {
      secondaire: [
        { id: "devoir", label: "Evaluation ecrite", active: true },
        { id: "interrogation", label: "Interro orale", active: true },
        { id: "examen", label: "Examen final", active: true },
        { id: "composition", label: "Compo", active: true },
      ],
    },
  };

  assert.equal(resolveCanonicalNoteType("Interro orale", schoolInfo, "secondaire"), "Interrogation");
  assert.equal(resolveCanonicalNoteType("Compo", schoolInfo, "secondaire"), "Composition");
});

test("getEvaluationLabel retourne le libelle personnalise pour l'affichage", () => {
  const schoolInfo = {
    evaluationForms: {
      examens: [
        { id: "composition", label: "Compo trimestrielle", active: true },
        { id: "examen", label: "Examen", active: true },
        { id: "controle", label: "Controle", active: true },
        { id: "devoir_surveille", label: "DS", active: true },
        { id: "brevet_blanc", label: "Brevet blanc", active: true },
        { id: "bac_blanc", label: "BAC blanc", active: true },
      ],
    },
  };

  assert.equal(getEvaluationLabel("Composition", schoolInfo, { kind: "exam" }), "Compo trimestrielle");
});

test("getActiveExamForms garde un fallback si tout est masque", () => {
  const schoolInfo = {
    evaluationForms: {
      examens: [
        { id: "composition", label: "Composition", active: false },
        { id: "examen", label: "Examen", active: false },
        { id: "controle", label: "Controle", active: false },
        { id: "devoir_surveille", label: "DS", active: false },
        { id: "brevet_blanc", label: "Brevet blanc", active: false },
        { id: "bac_blanc", label: "BAC blanc", active: false },
      ],
    },
  };

  const forms = getActiveExamForms(schoolInfo);

  assert.ok(forms.length > 0);
  assert.equal(resolveCanonicalExamType("DS", schoolInfo), "Devoir surveillé");
});

// Paramètres → Évaluations affiche sous chaque forme sa place dans le calcul
// (getSubjectAverage). Elle se lit sur la valeur interne : renommer une forme
// ne la déplace pas.
test("getEffetForme décrit la place de chaque forme du secondaire dans la moyenne", () => {
  const effets = Object.fromEntries(
    getEvaluationFormsConfig({}).secondaire.map((item) => [item.id, getEffetForme("secondaire", item.value)]),
  );
  assert.equal(effets.devoir.texte, "Note de classe · partie écrite");
  assert.equal(effets.evaluation_ecrite.texte, "Note de classe · partie écrite");
  assert.equal(effets.examen.texte, "Note de classe · partie écrite");
  assert.equal(effets.interrogation.texte, "Note de classe · partie orale");
  assert.equal(effets.evaluation_orale.texte, "Note de classe · partie orale");
  assert.equal(effets.composition.texte, "Composition · compte double face à la note de classe");
  assert.equal(effets.moyenne.texte, "Remplace toutes les autres notes de la matière");
  assert.deepEqual(
    Object.entries(effets).filter(([, e]) => e.fort).map(([id]) => id),
    ["moyenne"],
  );
});

// Dictée et Questions / Rédaction sont des MATIÈRES « évaluées seulement »
// (matiere-nature.js), plus des formes de notes : ni dans Paramètres →
// Évaluations, ni à la saisie, même pour une école qui les avait enregistrées.
test("Dictée/Questions et Rédaction ne sont plus des formes de notes", () => {
  const schoolInfo = {
    evaluationForms: {
      secondaire: [
        { id: "dictee_questions", label: "Dictée/Questions (Français)", active: true, college: true },
        { id: "redaction", label: "Rédaction (Français)", active: true, college: true },
      ],
    },
  };
  const ids = getEvaluationFormsConfig(schoolInfo).secondaire.map((item) => item.id);
  assert.ok(!ids.includes("dictee_questions") && !ids.includes("redaction"));
  for (const section of ["prescolaire", "primaire", "college", "lycee", "secondaire"]) {
    const valeurs = getActiveNoteForms(schoolInfo, section).map((item) => item.value);
    assert.ok(!valeurs.includes("Dictée/Questions") && !valeurs.includes("Rédaction"), section);
  }
});

test("getEffetForme : au primaire toutes les notes pèsent autant, sauf la Moyenne", () => {
  for (const item of getEvaluationFormsConfig({}).primaire) {
    const effet = getEffetForme("primaire", item.value);
    if (item.id === "moyenne") assert.equal(effet.fort, true);
    else assert.equal(effet.texte, "Moyenne simple : même poids que les autres notes");
  }
  // Les épreuves du module Examens ne touchent pas aux notes.
  assert.equal(getEffetForme("examens", "Composition"), null);
});

test("getEffetForme suit la valeur interne, pas le libellé choisi par l'école", () => {
  const schoolInfo = { evaluationForms: { secondaire: [{ id: "interrogation", label: "Devoir surveillé", active: true }] } };
  const interro = getEvaluationFormsConfig(schoolInfo).secondaire.find((item) => item.id === "interrogation");
  assert.equal(interro.label, "Devoir surveillé");
  assert.equal(getEffetForme("secondaire", interro.value).texte, "Note de classe · partie orale");
});

test("getAvertissementSaisie prévient seulement quand la forme écarte les autres notes", () => {
  assert.match(getAvertissementSaisie("Moyenne"), /remplace toutes les autres notes/);
  for (const type of ["Devoir", "Interrogation", "Évaluation orale", "Évaluation écrite", "Examen", "Composition", ""]) {
    assert.equal(getAvertissementSaisie(type), null, type);
  }
});
