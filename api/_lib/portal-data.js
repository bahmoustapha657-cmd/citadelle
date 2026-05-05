import { FieldPath } from "firebase-admin/firestore";
import { getParentStudentLinks } from "./account-links.js";

const SECTION_COLLECTIONS = {
  primaire: {
    notes: "notesPrimaire",
    eleves: "elevesPrimaire",
    enseignements: "ensPrimaire_enseignements",
    emplois: "classesPrimaire_emplois",
  },
  college: {
    notes: "notesCollege",
    eleves: "elevesCollege",
    enseignements: "ensCollege_enseignements",
    emplois: "classesCollege_emplois",
  },
  lycee: {
    notes: "notesLycee",
    eleves: "elevesLycee",
    enseignements: "ensLycee_enseignements",
    emplois: "classesLycee_emplois",
  },
};

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

export function normalizeSection(section = "") {
  const normalized = String(section || "").trim().toLowerCase();
  if (normalized === "secondaire") return "college";
  return SECTION_COLLECTIONS[normalized] ? normalized : "college";
}

export function getSectionCollections(section = "") {
  return SECTION_COLLECTIONS[normalizeSection(section)];
}

// Retire un éventuel suffixe legacy "(Matière)" en fin de nom.
// Avant le 2026-04, l'EDT stockait l'enseignant sous la forme
// "Prénom Nom (Mathématiques)". Maintenant on stocke juste "Prénom Nom",
// mais des données antérieures persistent — ce strip permet au portail
// enseignant de retrouver SES créneaux dans les deux formats.
function stripLegacyTeacherSuffix(value = "") {
  return String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function getTeacherAliases(profile = {}) {
  return uniqueStrings([profile.enseignantNom, profile.nom]);
}

export function matchesTeacherAlias(value = "", aliases = []) {
  const normalizedValue = normalizeText(stripLegacyTeacherSuffix(value));
  if (!normalizedValue) return false;
  return aliases.some((alias) => {
    const normalizedAlias = normalizeText(stripLegacyTeacherSuffix(alias));
    return normalizedAlias && normalizedAlias === normalizedValue;
  });
}

export function matchesStudentLink(student = {}, link = {}, section = "") {
  const targetSection = normalizeSection(link.section || section);
  const studentSection = normalizeSection(student.section || section);

  return !!(
    student._id
    && link.eleveId
    && String(student._id).trim() === String(link.eleveId).trim()
    && targetSection === studentSection
  );
}

export function filterParentStudents(profile = {}, students = [], section = "") {
  const links = getParentStudentLinks(profile);
  return students.filter((student) => links.some((link) => matchesStudentLink(student, link, section)));
}

export function getProfileStudentIds(profile = {}, students = []) {
  return uniqueStrings([
    ...(Array.isArray(profile.eleveIds) ? profile.eleveIds : []),
    ...students.map((student) => student._id),
  ]);
}

export function sortByDateDesc(items = [], field = "date") {
  return [...items].sort((left, right) => Number(right?.[field] || 0) - Number(left?.[field] || 0));
}

export function toItem(docSnap) {
  return { _id: docSnap.id, ...docSnap.data() };
}

function chunkArray(values = [], size = 10) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function getDocsByIds(collectionRef, ids = []) {
  const normalizedIds = uniqueStrings(ids);
  if (normalizedIds.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    chunkArray(normalizedIds).map((chunk) => (
      collectionRef.where(FieldPath.documentId(), "in", chunk).get()
    )),
  );

  return snapshots.flatMap((snapshot) => snapshot.docs.map(toItem));
}

export async function getDocsByFieldValues(collectionRef, field, values = []) {
  const normalizedValues = uniqueStrings(values);
  if (normalizedValues.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    chunkArray(normalizedValues).map((chunk) => collectionRef.where(field, "in", chunk).get()),
  );

  return snapshots.flatMap((snapshot) => snapshot.docs.map(toItem));
}

export function uniqueById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?._id || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
