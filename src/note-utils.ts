import { getSectionForClasse } from "./constants.js";

export type SectionName = "primaire" | "college" | "lycee" | string;

export type Note = {
  type?: string;
  note?: number | string | null;
  matiere?: string;
};

export type Matiere = {
  nom: string;
  coefficient?: number | string;
};

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

const normalizeType = (value: string = ""): string => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "");

const averageNumbers = (values: Array<number | string | null | undefined> = []): number | null => {
  const nums = values
    .filter((value): value is number | string => value !== null && value !== undefined && value !== "")
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

export const isSecondarySection = (section: SectionName = ""): boolean =>
  section === "college" || section === "lycee";

export const isSecondaryClasse = (classe: string = ""): boolean =>
  isSecondarySection(getSectionForClasse(classe));

export const getSecondarySubjectAverage = (notes: Note[] = []): number | null => {
  const oral = averageNumbers(
    notes.filter((note) => ORAL_TYPES.has(normalizeType(note.type))).map((note) => note.note ?? null),
  );
  const composition = averageNumbers(
    notes.filter((note) => COMPOSITION_TYPES.has(normalizeType(note.type))).map((note) => note.note ?? null),
  );
  const written = averageNumbers(
    notes
      .filter((note) => {
        const type = normalizeType(note.type);
        return !ORAL_TYPES.has(type) && !COMPOSITION_TYPES.has(type);
      })
      .map((note) => note.note ?? null),
  );

  const noteCours = averageNumbers([oral, written]);
  if (noteCours != null && composition != null) {
    return (noteCours + (2 * composition)) / 3;
  }
  if (composition != null) return composition;
  return noteCours;
};

export const getSubjectAverage = (
  notes: Note[] = [],
  classe: string = "",
  section: SectionName = "",
): number | null => {
  const effectiveSection = section || getSectionForClasse(classe);
  if (isSecondarySection(effectiveSection)) {
    return getSecondarySubjectAverage(notes);
  }
  return averageNumbers(notes.map((note) => note.note ?? null));
};

export const getGeneralAverage = (
  notes: Note[] = [],
  matieres: Matiere[] = [],
  classe: string = "",
  section: SectionName = "",
): number | null => {
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
    total += (moyenne != null ? moyenne : 0) * coef;
  });

  if (!totalCoef) return null;
  return total / totalCoef;
};
