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

// Saisie directe de la moyenne d'une matière : si présente, elle prime sur
// tout le reste (Cours/Composition) dans le calcul, quelle que soit la section.
const MOYENNE_TYPES = new Set([
  "moyenne",
  "moyenne matiere",
  "moyenne de la matiere",
]);

// Rubriques du Français au collège : Dictée/Questions (coef 2) + Rédaction
// (coef 1), chacune notée /20. Dès qu'une rubrique est présente, la moyenne de
// la matière est leur moyenne pondérée (résultat /20). Détection par type de
// note (seul le Français utilise ces rubriques en pratique).
const RUBRIQUE_WEIGHTS = new Map<string, number>([
  ["dictee/questions", 2],
  ["redaction", 1],
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

// Moyenne de matière saisie DIRECTEMENT (type « Moyenne de la matière ») :
// moyenne de ces seules notes, ou null s'il n'y en a aucune. Elle prime sur
// tout le reste — y compris sur le découpage en périodes pour la moyenne
// annuelle (voir annual-notes.js) : si l'école saisit la moyenne de la
// matière, on ne divise pas par le nombre de trimestres/semestres.
export const getDirectSubjectAverage = (notes: Note[] = []): number | null => {
  const moyennes = notes.filter((note) => MOYENNE_TYPES.has(normalizeType(note.type)));
  if (!moyennes.length) return null;
  return averageNumbers(moyennes.map((note) => note.note ?? null));
};

export const getSubjectAverage = (
  notes: Note[] = [],
  classe: string = "",
  section: SectionName = "",
): number | null => {
  // Priorité absolue à une moyenne de matière saisie directement.
  const directe = getDirectSubjectAverage(notes);
  if (directe != null) return directe;

  const effectiveSection = section || getSectionForClasse(classe);

  // Rubriques (Français) : moyenne pondérée 2:1 — COLLÈGE uniquement.
  if (effectiveSection === "college") {
    const rubriques = notes.filter((note) => RUBRIQUE_WEIGHTS.has(normalizeType(note.type)));
    if (rubriques.length) {
      let total = 0;
      let totalPoids = 0;
      RUBRIQUE_WEIGHTS.forEach((poids, cle) => {
        const moy = averageNumbers(
          rubriques.filter((note) => normalizeType(note.type) === cle).map((note) => note.note ?? null),
        );
        if (moy != null) { total += moy * poids; totalPoids += poids; }
      });
      if (totalPoids) return total / totalPoids;
    }
  }

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

// Moyenne annuelle = moyenne des périodes, diviseur FIXE au nombre total
// de périodes de l'année :
//   (T1 + T2 + T3) / 3   trimestre
//   (S1 + S2) / 2        semestre
//   (M1 + … + M9) / 9    mensuel
// Les périodes sans moyenne comptent 0 (diviseur inchangé) ; en fin d'année
// toutes les périodes sont renseignées → vraie moyenne arithmétique.
// Retourne null UNIQUEMENT si TOUTES les périodes sont vides.
export const getAnnualAverage = (
  periodAverages: Array<number | null> = [],
): number | null => {
  if (!Array.isArray(periodAverages) || periodAverages.length === 0) return null;
  const valides = periodAverages.filter((v): v is number => v != null && Number.isFinite(v));
  if (valides.length === 0) return null;
  const sum = valides.reduce((acc, v) => acc + v, 0);
  return sum / periodAverages.length;
};
