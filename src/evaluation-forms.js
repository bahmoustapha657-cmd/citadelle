const DEFAULT_EVALUATION_FORMS = {
  primaire: [
    { id: "devoir", value: "Devoir", label: "Devoir", active: true },
    { id: "interrogation", value: "Interrogation", label: "Interrogation", active: true },
    { id: "examen", value: "Examen", label: "Examen", active: false },
    { id: "composition", value: "Composition", label: "Composition", active: false },
  ],
  secondaire: [
    { id: "devoir", value: "Devoir", label: "Devoir", active: true },
    { id: "interrogation", value: "Interrogation", label: "Interrogation", active: true },
    { id: "examen", value: "Examen", label: "Examen", active: true },
    { id: "composition", value: "Composition", label: "Composition", active: true },
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

export const getActiveNoteForms = (schoolInfo = {}, section = "secondaire") => {
  const config = getEvaluationFormsConfig(schoolInfo);
  const key = section === "primaire" ? "primaire" : "secondaire";
  const forms = config[key].filter((item) => item.active);
  return forms.length ? forms : DEFAULT_EVALUATION_FORMS[key].filter((item) => item.active);
};

export const getActiveExamForms = (schoolInfo = {}) => {
  const forms = getEvaluationFormsConfig(schoolInfo).examens.filter((item) => item.active);
  return forms.length ? forms : DEFAULT_EVALUATION_FORMS.examens.filter((item) => item.active);
};

export const getEvaluationLabel = (value = "", schoolInfo = {}, options = {}) => {
  const normalizedValue = normalizeText(value);
  const key = options.kind === "exam"
    ? "examens"
    : (options.section === "primaire" ? "primaire" : "secondaire");
  const forms = getEvaluationFormsConfig(schoolInfo)[key];
  const match = forms.find((item) => normalizeText(item.value) === normalizedValue || normalizeText(item.label) === normalizedValue);
  return match?.label || value;
};

export const resolveCanonicalNoteType = (value = "", schoolInfo = {}, section = "secondaire") => {
  const normalizedValue = normalizeText(value);
  const forms = getEvaluationFormsConfig(schoolInfo)[section === "primaire" ? "primaire" : "secondaire"];
  const match = forms.find((item) => normalizeText(item.value) === normalizedValue || normalizeText(item.label) === normalizedValue);
  return match?.value || String(value || "").trim() || "Devoir";
};

export const resolveCanonicalExamType = (value = "", schoolInfo = {}) => {
  const normalizedValue = normalizeText(value);
  const forms = getEvaluationFormsConfig(schoolInfo).examens;
  const match = forms.find((item) => normalizeText(item.value) === normalizedValue || normalizeText(item.label) === normalizedValue);
  return match?.value || String(value || "").trim() || "Composition";
};
