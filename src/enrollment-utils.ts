export type EnrollmentStudent = {
  _id?: string;
  nom?: string;
  prenom?: string;
  filiation?: string;
  dateNaissance?: string;
  ien?: string;
  matricule?: string;
  classe?: string;
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

// Mots de liaison d'une filiation, sans valeur pour la comparer : « Fils de
// Mamadou Diallo et de Aïssatou Bah » = « Père : Mamadou Diallo / Mère :
// Aissatou Bah ». Même liste côté base (eleve_cle_filiation).
const MOTS_FILIATION = new Set(["pere", "mere", "fils", "fille", "de", "d", "du", "et"]);

export const normalizeFiliation = (value: string = ""): string => normalizeToken(value)
  .replace(/[^a-z0-9]+/g, " ")
  .split(" ")
  .filter((mot) => mot && !MOTS_FILIATION.has(mot))
  .join(" ");

// Un élève = nom + prénom + filiation. Les homonymes sont courants (quatre
// « Diallo Ibrahima » dans une école) : c'est la filiation qui les départage,
// puis la date de naissance quand les deux fiches en ont une.
const buildIdentityKey = (student: EnrollmentStudent = {}): string => {
  const nom = normalizeToken(student.nom);
  const prenom = normalizeToken(student.prenom);
  const filiation = normalizeFiliation(student.filiation);
  if (!nom || !prenom || !filiation) return "";
  return `${nom}|${prenom}|${filiation}`;
};

export const normalizeEnrollmentText = normalizeToken;

// Filiation exigée pour inscrire un élève : sans elle, rien ne permet de
// savoir s'il est déjà inscrit.
export const MESSAGE_FILIATION_OBLIGATOIRE = "Filiation obligatoire (père et mère) : elle permet de vérifier que l'élève n'est pas déjà inscrit.";
export const filiationManquante = (student: EnrollmentStudent = {}): boolean => !normalizeFiliation(student.filiation);

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

  // Même nom, prénom et filiation : le même élève, sauf si les deux fiches
  // portent des dates de naissance différentes (deux enfants des mêmes
  // parents, portant le même nom).
  const identityKey = buildIdentityKey(candidate);
  if (identityKey) {
    const date = normalizeDate(candidate.dateNaissance);
    const existing = pool.find((student) => buildIdentityKey(student) === identityKey
      && !(date && normalizeDate(student.dateNaissance) && normalizeDate(student.dateNaissance) !== date));
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
  const e = duplicate.student || {};
  const details = [e.classe, e.matricule && `matricule ${e.matricule}`].filter(Boolean).join(", ");
  return `Doublon detecte: ${e.nom || ""} ${e.prenom || ""}, meme filiation, est deja inscrit(e)${details ? ` (${details})` : ""}${suffix}.`;
};
