export type EnrollmentStudent = {
  _id?: string;
  nom?: string;
  prenom?: string;
  dateNaissance?: string;
  ien?: string;
  matricule?: string;
};

export type EnrollmentDuplicate = {
  type: "ien" | "matricule" | "identity";
  student: EnrollmentStudent;
};

type FindEnrollmentDuplicateOptions = {
  excludeId?: string | null;
};

type GetEnrollmentDuplicateMessageOptions = {
  scope?: string;
};

const normalizeToken = (value: string = ""): string => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/\s+/g, " ");

const normalizeIdentifier = (value: string = ""): string => normalizeToken(value).replace(/\s+/g, "");

const normalizeDate = (value: string = ""): string => String(value || "").trim();

const buildIdentityKey = (student: EnrollmentStudent = {}): string => {
  const nom = normalizeToken(student.nom);
  const prenom = normalizeToken(student.prenom);
  const dateNaissance = normalizeDate(student.dateNaissance);
  if (!nom || !prenom || !dateNaissance) return "";
  return `${nom}|${prenom}|${dateNaissance}`;
};

export const normalizeEnrollmentText = normalizeToken;

export const findEnrollmentDuplicate = (
  candidate: EnrollmentStudent = {},
  students: EnrollmentStudent[] = [],
  options: FindEnrollmentDuplicateOptions = {},
): EnrollmentDuplicate | null => {
  const excludeId = options.excludeId ?? candidate?._id ?? null;
  const pool = (students || []).filter((student) => student && student._id !== excludeId);

  const ien = normalizeIdentifier(candidate.ien);
  if (ien) {
    const existing = pool.find((student) => normalizeIdentifier(student.ien) === ien);
    if (existing) return { type: "ien", student: existing };
  }

  const matricule = normalizeIdentifier(candidate.matricule);
  if (matricule) {
    const existing = pool.find((student) => normalizeIdentifier(student.matricule) === matricule);
    if (existing) return { type: "matricule", student: existing };
  }

  const identityKey = buildIdentityKey(candidate);
  if (identityKey) {
    const existing = pool.find((student) => buildIdentityKey(student) === identityKey);
    if (existing) return { type: "identity", student: existing };
  }

  return null;
};

export const getEnrollmentDuplicateMessage = (
  duplicate: EnrollmentDuplicate | null,
  candidate: EnrollmentStudent = {},
  options: GetEnrollmentDuplicateMessageOptions = {},
): string => {
  if (!duplicate) return "";
  const suffix = options.scope ? ` (${options.scope})` : "";
  if (duplicate.type === "ien") {
    return `Doublon detecte: l'IEN ${candidate.ien || duplicate.student?.ien || ""} est deja utilise${suffix}.`;
  }
  if (duplicate.type === "matricule") {
    return `Doublon detecte: le matricule ${candidate.matricule || duplicate.student?.matricule || ""} existe deja${suffix}.`;
  }
  return `Doublon detecte: meme nom, prenom et date de naissance${suffix}.`;
};
