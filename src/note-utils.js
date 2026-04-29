import { getSectionForClasse } from "./constants.js";

const ORAL_TYPES = new Set([
  "interrogation",
  "oral",
  "orale",
  "evaluation orale",
  "évaluation orale",
]);

const COMPOSITION_TYPES = new Set([
  "composition",
  "compo",
]);

const normalizeType = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "");

const averageNumbers = (values = []) => {
  const nums = values
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

export const isSecondarySection = (section = "") => section === "college" || section === "lycee";

export const isSecondaryClasse = (classe = "") => isSecondarySection(getSectionForClasse(classe));

export const getSecondarySubjectAverage = (notes = []) => {
  const oral = averageNumbers(
    notes.filter((note) => ORAL_TYPES.has(normalizeType(note.type))).map((note) => note.note),
  );
  const composition = averageNumbers(
    notes.filter((note) => COMPOSITION_TYPES.has(normalizeType(note.type))).map((note) => note.note),
  );
  const written = averageNumbers(
    notes
      .filter((note) => {
        const type = normalizeType(note.type);
        return !ORAL_TYPES.has(type) && !COMPOSITION_TYPES.has(type);
      })
      .map((note) => note.note),
  );

  const noteCours = averageNumbers([oral, written]);
  if (noteCours != null && composition != null) {
    return (noteCours + (2 * composition)) / 3;
  }
  if (composition != null) return composition;
  return noteCours;
};

export const getSubjectAverage = (notes = [], classe = "", section = "") => {
  const effectiveSection = section || getSectionForClasse(classe);
  if (isSecondarySection(effectiveSection)) {
    return getSecondarySubjectAverage(notes);
  }
  return averageNumbers(notes.map((note) => note.note));
};

export const getGeneralAverage = (notes = [], matieres = [], classe = "", section = "") => {
  const effectiveSection = section || getSectionForClasse(classe);
  let total = 0;
  let totalCoef = 0;

  matieres.forEach((matiere) => {
    const coef = Number(matiere.coefficient || 1);
    totalCoef += coef;
    const moyenne = getSubjectAverage(
      notes.filter((note) => note.matiere === matiere.nom),
      classe,
      effectiveSection,
    );
    if (moyenne != null) total += moyenne * coef;
  });

  if (!totalCoef) return null;
  return total / totalCoef;
};
