import test from "node:test";
import assert from "node:assert/strict";

import {
  getActiveExamForms,
  getActiveNoteForms,
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

  assert.deepEqual(forms.map((item) => item.label), ["Test ecrit", "Compo"]);
  assert.deepEqual(forms.map((item) => item.value), ["Devoir", "Composition"]);
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
