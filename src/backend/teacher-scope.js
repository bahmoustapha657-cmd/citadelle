// ── Périmètre enseignant (logique pure, répliquée du handler serveur) ───────
// Mêmes règles que api/_lib/handlers/teacher-portal.js + portal-data.js, mais
// côté client (le portail enseignant lit désormais Supabase directement).
// Seul écart : la maternelle (« prescolaire »), que ce handler du chemin
// Firebase historique ne connaît pas.
import { SECTIONS_ECOLE, getSectionSlug } from "../constants.js";

export function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function stripLegacyTeacherSuffix(value = "") {
  return String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// Section du portail : l'une des sections de l'école, maternelle comprise ;
// « secondaire » (comptes historiques) vaut collège, l'inconnu aussi.
export function normalizeSection(section = "") {
  const s = String(section || "").trim().toLowerCase();
  if (s === "secondaire") return "college";
  return SECTIONS_ECOLE.includes(s) ? s : "college";
}

// Segment des collections lues et écrites par le portail pour une section
// (classesPrescolaire, notesPrimaire, elevesCollege…) : celui des clés du
// module École. Tant que normalizeSection ignorait « prescolaire », un compte
// de maternelle aurait lu les collections du COLLÈGE.
export function teacherCollectionSlug(section = "") {
  return getSectionSlug(normalizeSection(section));
}

// Maternelle et primaire : le titulaire enseigne TOUTES les matières de sa
// classe, sa saisie n'est donc pas filtrée par matière — même règle que
// teacher_can_write_note côté RLS. Collège et lycée : la matière du profil.
export function isTitulaireSection(section = "") {
  return ["prescolaire", "primaire"].includes(normalizeSection(section));
}

// Section inscrite sur le compte d'un enseignant créé depuis le module École
// (prop `section` d'Ecole) : celle du module, maternelle comprise. Jusqu'au
// 2026-09-24, la maternelle y était ramenée à « primaire », faute d'être
// connue du portail (ci-dessus), de l'Edge Function account-manage (la
// Direction primaire n'y créait que des enseignants « primaire ») et de la
// RLS teacher_can_write_note (dispense du filtre matière). Les comptes créés
// ainsi se reprennent avec supabase/reprendre-comptes-prescolaire.mjs.
export function teacherAccountSection(section = "") {
  return section;
}

export function teacherAliases(profile = {}) {
  return [...new Set([profile.enseignantNom, profile.nom]
    .filter(Boolean).map((s) => String(s).trim()).filter(Boolean))];
}

export function matchesTeacherAlias(value = "", aliases = []) {
  const nv = normalizeText(stripLegacyTeacherSuffix(value));
  if (!nv) return false;
  return aliases.some((a) => {
    const na = normalizeText(stripLegacyTeacherSuffix(a));
    return na && na === nv;
  });
}

// Une note est-elle dans le périmètre (classe + matière) de l'enseignant ?
// Maternelle et primaire : titulaire multi-matières → pas de filtre matière.
// Secondaire : la matière du profil est obligatoire.
export function noteBelongsToTeacherScope(note = {}, studentIds = new Set(), matiere = "", studentNames = new Set(), section = "college", teacherClasses = null) {
  const sid = String(note.eleveId || "").trim();
  if (sid) {
    if (!studentIds.has(sid)) return false;
  } else {
    const nm = normalizeText(note.eleveNom);
    if (!nm || !studentNames.has(nm)) return false;
    if (teacherClasses instanceof Set && teacherClasses.size > 0) {
      const nc = String(note.classe || "").trim();
      if (!nc || !teacherClasses.has(nc)) return false;
    }
  }
  if (!isTitulaireSection(section)) {
    if (!matiere) return false;
    if (normalizeText(note.matiere) !== normalizeText(matiere)) return false;
  }
  return true;
}
