import { calcMoisAnnee, getSectionForClasse, TOUS_MOIS_COURTS } from "./constants.js";
import { estEvaluee } from "./matiere-nature.js";
import { estPeriodeMois, moisDePeriode } from "./period-utils.js";

export type SectionName = "primaire" | "college" | "lycee" | string;

export type Note = {
  type?: string;
  note?: number | string | null;
  matiere?: string;
  periode?: string;
  // Mois de l'évaluation (« Oct »…) : oraux et écrits du secondaire.
  mois?: string | null;
  annee?: string;
  // Date de saisie (epoch ms, ou chaîne ISO) : range une note sans mois.
  createdAt?: number | string | null;
};

export type Matiere = {
  nom: string;
  coefficient?: number | string;
  nature?: string;
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
// Ces types ne sont plus proposés à la saisie (2026-11-02) : Dictée et
// Questions / Rédaction sont désormais des MATIÈRES « évaluées seulement »
// (matiere-nature.js). Le calcul reste pour les notes déjà saisies sous ces
// types : les anciens bulletins gardent leurs moyennes.
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

// Place d'un type de note dans getSubjectAverage, affichée dans Paramètres →
// Évaluations et à la saisie : renommer une forme ne change que son libellé,
// jamais sa place dans le calcul. « ecrit » = tout le reste (Devoir,
// Évaluation écrite, Examen…). Au primaire et en maternelle, seule
// « moyenne » se distingue : toutes les autres notes ont le même poids.
export type NoteTypeRole = "moyenne" | "rubrique" | "oral" | "composition" | "ecrit";

export const getNoteTypeRole = (type: string = ""): NoteTypeRole => {
  const t = normalizeType(type);
  if (MOYENNE_TYPES.has(t)) return "moyenne";
  if (RUBRIQUE_WEIGHTS.has(t)) return "rubrique";
  if (ORAL_TYPES.has(t)) return "oral";
  if (COMPOSITION_TYPES.has(t)) return "composition";
  return "ecrit";
};

export const isSecondarySection = (section: SectionName = ""): boolean =>
  section === "college" || section === "lycee";

export const isSecondaryClasse = (classe: string = ""): boolean =>
  isSecondarySection(getSectionForClasse(classe));

// ── Mois des évaluations ────────────────────────────────────────────────────
// Règle de la direction (2026-11-25) : au secondaire, on évalue à l'oral et à
// l'écrit CHAQUE mois, quelle que soit la périodicité. Chaque oral et chaque
// écrit porte donc le mois où il a eu lieu ; la composition n'en a pas (une
// par période — chaque mois en périodicité mensuelle, la période étant alors
// le mois). Primaire et maternelle : pas de mois, toutes les notes ont le
// même poids.
export const noteAvecMois = (type: string = "", section: SectionName = ""): boolean => {
  if (section === "primaire" || section === "prescolaire") return false;
  const role = getNoteTypeRole(type);
  return role === "oral" || role === "ecrit";
};

// Mois de l'année scolaire de l'école (calcMoisAnnee) : sert à vérifier que
// le mois tiré de la date de saisie d'une note tombe dans sa période. Réglé
// par App d'après schoolInfo.moisDebut ; rentrée en octobre par défaut.
let moisAnneeNotes: string[] = calcMoisAnnee("Octobre");
export const definirCalendrierNotes = (moisDebut: string = ""): void => {
  moisAnneeNotes = calcMoisAnnee(moisDebut || "Octobre");
};

// Mois et année scolaire d'une date de saisie : le 14/10/2026 → « Oct »,
// 2026-2027. Septembre ouvre l'année (comme anneeScolaireDeDate).
const moisDeDate = (valeur: number | string | null | undefined): { mois: string; annee: string } | null => {
  if (valeur == null || valeur === "") return null;
  const date = new Date(typeof valeur === "number" ? valeur : Date.parse(String(valeur)));
  if (Number.isNaN(date.getTime())) return null;
  const m = date.getMonth();
  const an = date.getFullYear();
  return {
    mois: TOUS_MOIS_COURTS[(m + 4) % 12],
    annee: m >= 8 ? `${an}-${an + 1}` : `${an - 1}-${an}`,
  };
};

// Mois d'une note, pour le calcul de la note de cours :
//  1. le mois saisi ;
//  2. sinon, en périodicité mensuelle, la période elle-même ;
//  3. sinon le mois de sa date de saisie, s'il tombe dans sa période et son
//     année scolaire — note saisie avant que le mois soit demandé (choix de
//     la direction, 2026-11-25 : rien n'est réécrit en base) ;
//  4. sinon null, « sans mois » : saisie tardive, notes restaurées d'une
//     archive, copiées… Les notes sans mois d'une période comptent ensemble
//     comme un seul mois — sans aucun mois, c'est le calcul d'avant.
export const moisDeNote = (note: Note = {}, moisAnnee: string[] = moisAnneeNotes): string | null => {
  if (note.mois) return String(note.mois);
  const periode = String(note.periode || "");
  if (estPeriodeMois(periode)) return periode;
  const saisie = moisDeDate(note.createdAt);
  if (!saisie) return null;
  if (note.annee && saisie.annee !== note.annee) return null;
  return moisDePeriode(periode, moisAnnee).includes(saisie.mois) ? saisie.mois : null;
};

// Les deux notes dont le secondaire tire la moyenne d'une matière : la note de
// cours et la note de composition.
//
// Note de cours, MOIS PAR MOIS (règle de la direction, 2026-11-25) :
//   mois    = (moyenne des oraux du mois + moyenne des écrits du mois) ÷ 2
//   période = moyenne des mois de la période — (M1 + M2 + M3) ÷ 3 au trimestre.
// Un mois où l'élève n'a que l'oral, ou que l'écrit, vaut cette seule note ;
// un mois sans aucune note de l'élève ne compte pas. Avec un oral et un écrit
// chaque mois, c'est l'ancien calcul (moyenne de tous les oraux + moyenne de
// tous les écrits) ÷ 2 ; les deux diffèrent quand un mois a plus ou moins
// d'évaluations que les autres.
const getSecondaryParts = (notes: Note[] = []): { cours: number | null; composition: number | null } => {
  const composition = averageNumbers(
    notes.filter((note) => COMPOSITION_TYPES.has(normalizeType(note.type))).map((note) => note.note ?? null),
  );
  const parMois = new Map<string, { oraux: Array<Note["note"]>; ecrits: Array<Note["note"]> }>();
  notes.forEach((note) => {
    const type = normalizeType(note.type);
    if (COMPOSITION_TYPES.has(type)) return;
    const cle = moisDeNote(note) ?? "";
    const mois = parMois.get(cle) || { oraux: [], ecrits: [] };
    (ORAL_TYPES.has(type) ? mois.oraux : mois.ecrits).push(note.note ?? null);
    parMois.set(cle, mois);
  });
  const cours = averageNumbers(
    [...parMois.values()].map(({ oraux, ecrits }) => averageNumbers([averageNumbers(oraux), averageNumbers(ecrits)])),
  );
  return { cours, composition };
};

export const getSecondarySubjectAverage = (notes: Note[] = []): number | null => {
  const { cours: noteCours, composition } = getSecondaryParts(notes);
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

// Détail imprimé au bulletin : note de classe et note de composition, telles
// que getSubjectAverage les combine au secondaire. Null quand la moyenne ne se
// décompose pas ainsi — moyenne saisie directement, rubriques du Français au
// collège, primaire et maternelle (moyenne simple de toutes les notes).
export const getSubjectParts = (
  notes: Note[] = [],
  classe: string = "",
  section: SectionName = "",
): { cours: number | null; composition: number | null } | null => {
  if (getDirectSubjectAverage(notes) != null) return null;
  const effectiveSection = section || getSectionForClasse(classe);
  if (!isSecondarySection(effectiveSection)) return null;
  if (effectiveSection === "college" && notes.some((note) => (
    RUBRIQUE_WEIGHTS.has(normalizeType(note.type)) && averageNumbers([note.note ?? null]) != null
  ))) return null;
  return getSecondaryParts(notes);
};

// Matières qui COMPTENT dans la moyenne générale d'une classe : celles qu'au
// moins un élève de la classe a notées dans `notesClasse` (une période, ou
// les notes annuelles synthétiques pour la fin d'année).
//
// Règle accordée par la direction de La Citadelle (2026-11-02) : une matière
// que personne n'a notée dans la classe pour la période ne compte pas — elle
// n'entre pas au dénominateur. Avant, chacune comptait 0 à son coefficient :
// une matière créée en cours d'année, ou que son professeur n'avait pas pu
// noter, faisait baisser la moyenne de toute la classe. Une matière notée
// pour CERTAINS élèves compte toujours 0 pour ceux qui n'ont rien : c'est la
// note manquée d'un élève, pas une matière restée sans évaluation.
//
// Ne sert qu'au CALCUL : la saisie propose toujours toutes les matières.
export const matieresNotees = <M extends Matiere>(matieres: M[] = [], notesClasse: Note[] = []): M[] => {
  const notees = new Set(
    notesClasse
      .filter((note) => averageNumbers([note.note ?? null]) != null)
      .map((note) => note.matiere),
  );
  return matieres.filter((matiere) => notees.has(matiere.nom));
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
    // Rubrique enseignée seulement (cf. matiere-nature.js) : jamais comptée,
    // même quand l'appelant passe la liste complète des matières — sinon
    // elle ferait baisser la moyenne d'un 0 à son coefficient.
    if (!estEvaluee(matiere)) return;
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
