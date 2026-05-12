export type Teacher = {
  _id?: string;
  nom?: string;
  prenom?: string;
  matiere?: string;
  classeTitle?: string;
  montantForfait?: number | string;
  salaireBase?: number | string;
};

type GetEligibleTeachersOptions = {
  classe?: string;
  matiere?: string;
  isPrimary?: boolean;
};

function normalizeText(value: string = ""): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

function matchesSubject(teacher: Teacher = {}, matiere: string = ""): boolean {
  const subject = normalizeText(matiere);
  if (!subject) return true;

  const teacherSubjects = String(teacher.matiere || "")
    .toLowerCase()
    .split(/[,/;]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  if (!teacherSubjects.length) return true;

  return teacherSubjects.some((item) => item.includes(subject) || subject.includes(item));
}

export function getTeacherMonthlyForfait(teacher: Teacher = {}): number {
  return Number(teacher.montantForfait || teacher.salaireBase || 0);
}

export function getEligibleTeachersForTimetable(
  teachers: Teacher[] = [],
  { classe = "", matiere = "", isPrimary = false }: GetEligibleTeachersOptions = {},
): Teacher[] {
  const subjectFiltered = teachers.filter((teacher) => matchesSubject(teacher, matiere));
  if (!isPrimary) return subjectFiltered;

  const classeNorm = normalizeText(classe);
  if (!classeNorm) return subjectFiltered;

  const titulaires = subjectFiltered.filter(
    (teacher) => normalizeText(teacher.classeTitle) === classeNorm,
  );

  return titulaires.length ? titulaires : subjectFiltered;
}
