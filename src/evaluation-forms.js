import { getNoteTypeRole } from "./note-utils.js";

const DEFAULT_EVALUATION_FORMS = {
  primaire: [
    { id: "devoir", value: "Devoir", label: "Devoir", active: true },
    { id: "interrogation", value: "Interrogation", label: "Interrogation", active: true },
    { id: "evaluation_orale", value: "Évaluation orale", label: "Évaluation orale", active: true },
    { id: "evaluation_ecrite", value: "Évaluation écrite", label: "Évaluation écrite", active: true },
    { id: "examen", value: "Examen", label: "Examen", active: false },
    { id: "composition", value: "Composition", label: "Composition", active: false },
    // Saisie directe de la moyenne d'une matière (fournie par l'enseignant) :
    // prime sur tout le reste dans le calcul (voir getSubjectAverage).
    { id: "moyenne", value: "Moyenne", label: "Moyenne de la matière", active: true },
  ],
  secondaire: [
    { id: "devoir", value: "Devoir", label: "Devoir", active: true },
    { id: "interrogation", value: "Interrogation", label: "Interrogation", active: true },
    { id: "evaluation_orale", value: "Évaluation orale", label: "Évaluation orale", active: true },
    { id: "evaluation_ecrite", value: "Évaluation écrite", label: "Évaluation écrite", active: true },
    { id: "examen", value: "Examen", label: "Examen", active: true },
    { id: "composition", value: "Composition", label: "Composition", active: true },
    // Plus de formes « Dictée/Questions » ni « Rédaction » : ce sont des
    // MATIÈRES « évaluées seulement » rattachées au Français, avec leur
    // coefficient (cf. matiere-nature.js). Les notes déjà saisies sous ces
    // types gardent leur calcul (RUBRIQUE_WEIGHTS) ; les entrées encore
    // enregistrées par les écoles sont ignorées par normalizeStoredForms.
    // Saisie directe de la moyenne d'une matière (fournie par l'enseignant) :
    // prime sur tout le reste dans le calcul (voir getSubjectAverage).
    { id: "moyenne", value: "Moyenne", label: "Moyenne de la matière", active: true },
  ],
  examens: [
    { id: "composition", value: "Composition", label: "Composition", active: true },
    { id: "examen", value: "Examen", label: "Examen", active: true },
    { id: "controle", value: "Contrôle", label: "Contrôle", active: true },
    { id: "devoir_surveille", value: "Devoir surveillé", label: "Devoir surveillé", active: true },
    { id: "brevet_blanc", value: "Brevet blanc", label: "Brevet blanc", active: true },
    { id: "bac_blanc", value: "BAC blanc", label: "BAC blanc", active: true },
  ],
};

const normalizeText = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const normalizeStoredForms = (stored = [], defaults = []) => defaults.map((item) => {
  const match = Array.isArray(stored) ? stored.find((entry) => entry?.id === item.id) : null;
  return {
    ...item,
    label: String(match?.label || item.label).trim() || item.label,
    active: typeof match?.active === "boolean" ? match.active : item.active,
  };
});

export const getEvaluationFormsConfig = (schoolInfo = {}) => {
  const stored = schoolInfo?.evaluationForms || {};
  return {
    primaire: normalizeStoredForms(stored.primaire, DEFAULT_EVALUATION_FORMS.primaire),
    secondaire: normalizeStoredForms(stored.secondaire, DEFAULT_EVALUATION_FORMS.secondaire),
    examens: normalizeStoredForms(stored.examens, DEFAULT_EVALUATION_FORMS.examens),
  };
};

// Groupe de Paramètres → Évaluations applicable à une section. La maternelle
// (« prescolaire ») suit le PRIMAIRE : c'est le groupe qu'elle utilisait tant
// qu'elle vivait dans le primaire (jusqu'au 2026-07-25), celui de ses notes
// sur 10 — comme sa périodicité et ses jours ouvrés. Depuis sa séparation,
// tout ce qui n'était pas « primaire » basculait sur le secondaire : la
// maternelle se voyait proposer les formes du collège, Dictée et Rédaction
// comprises.
export const getNoteFormsGroup = (section = "secondaire") =>
  (section === "primaire" || section === "prescolaire" ? "primaire" : "secondaire");

export const getActiveNoteForms = (schoolInfo = {}, section = "secondaire") => {
  const config = getEvaluationFormsConfig(schoolInfo);
  const key = getNoteFormsGroup(section);
  const active = config[key].filter((item) => item.active);
  return active.length ? active : DEFAULT_EVALUATION_FORMS[key].filter((item) => item.active);
};

export const getActiveExamForms = (schoolInfo = {}) => {
  const forms = getEvaluationFormsConfig(schoolInfo).examens.filter((item) => item.active);
  return forms.length ? forms : DEFAULT_EVALUATION_FORMS.examens.filter((item) => item.active);
};

export const getEvaluationLabel = (value = "", schoolInfo = {}, options = {}) => {
  const normalizedValue = normalizeText(value);
  const key = options.kind === "exam" ? "examens" : getNoteFormsGroup(options.section);
  const forms = getEvaluationFormsConfig(schoolInfo)[key];
  const match = forms.find((item) => normalizeText(item.value) === normalizedValue || normalizeText(item.label) === normalizedValue);
  return match?.label || value;
};

export const resolveCanonicalNoteType = (value = "", schoolInfo = {}, section = "secondaire") => {
  const normalizedValue = normalizeText(value);
  const forms = getEvaluationFormsConfig(schoolInfo)[getNoteFormsGroup(section)];
  const match = forms.find((item) => normalizeText(item.value) === normalizedValue || normalizeText(item.label) === normalizedValue);
  return match?.value || String(value || "").trim() || "Devoir";
};

// Effet d'une forme dans la moyenne de la matière, affiché sous son nom dans
// Paramètres → Évaluations. Tiré de getNoteTypeRole (la valeur interne, pas
// le libellé) : le texte suit le calcul réel, quel que soit le nom choisi
// par l'école. `fort` : la forme écarte les autres notes au lieu de s'y
// ajouter. Null pour les épreuves du module Examens (sans effet sur les notes).
export const getEffetForme = (groupId = "secondaire", value = "") => {
  if (groupId === "examens") return null;
  const role = getNoteTypeRole(value);
  if (role === "moyenne") return { texte: "Remplace toutes les autres notes de la matière", fort: true };
  if (groupId === "primaire") return { texte: "Moyenne simple : même poids que les autres notes", fort: false };
  if (role === "composition") return { texte: "Composition · compte double face à la note de classe", fort: false };
  if (role === "oral") return { texte: "Note de classe · partie orale", fort: false };
  return { texte: "Note de classe · partie écrite", fort: false };
};

// Avertissement sous le choix du type de note, à la saisie, quand la forme
// choisie écarte les autres notes de la matière au lieu de s'y ajouter.
export const getAvertissementSaisie = (value = "") => {
  if (getNoteTypeRole(value) === "moyenne") {
    return "Cette note remplace toutes les autres notes de la matière pour la période : devoirs, interrogations et composition ne comptent plus dans la moyenne.";
  }
  return null;
};

export const resolveCanonicalExamType = (value = "", schoolInfo = {}) => {
  const normalizedValue = normalizeText(value);
  const forms = getEvaluationFormsConfig(schoolInfo).examens;
  const match = forms.find((item) => normalizeText(item.value) === normalizedValue || normalizeText(item.label) === normalizedValue);
  return match?.value || String(value || "").trim() || "Composition";
};
