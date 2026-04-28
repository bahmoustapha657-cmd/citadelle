function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function matchesSubject(teacher = {}, matiere = "") {
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

export function getTeacherMonthlyForfait(teacher = {}) {
  return Number(teacher.montantForfait || teacher.salaireBase || 0);
}

export function getEligibleTeachersForTimetable(teachers = [], {
  classe = "",
  matiere = "",
  isPrimary = false,
} = {}) {
  const subjectFiltered = teachers.filter((teacher) => matchesSubject(teacher, matiere));
  if (!isPrimary) return subjectFiltered;

  const classeNorm = normalizeText(classe);
  if (!classeNorm) return subjectFiltered;

  const titulaires = subjectFiltered.filter(
    (teacher) => normalizeText(teacher.classeTitle) === classeNorm,
  );

  return titulaires.length ? titulaires : subjectFiltered;
}
