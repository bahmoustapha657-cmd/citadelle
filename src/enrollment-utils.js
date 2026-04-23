const normalizeToken = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ");

const normalizeIdentifier = (value = "") => normalizeToken(value).replace(/\s+/g, "");

const normalizeDate = (value = "") => String(value || "").trim();

const buildIdentityKey = (student = {}) => {
  const nom = normalizeToken(student.nom);
  const prenom = normalizeToken(student.prenom);
  const dateNaissance = normalizeDate(student.dateNaissance);
  if (!nom || !prenom || !dateNaissance) return "";
  return `${nom}|${prenom}|${dateNaissance}`;
};

export const normalizeEnrollmentText = normalizeToken;

export const findEnrollmentDuplicate = (candidate = {}, students = [], options = {}) => {
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

export const getEnrollmentDuplicateMessage = (duplicate, candidate = {}, options = {}) => {
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
