// ── Périmètre enseignant (logique pure, répliquée du handler serveur) ───────
// Mêmes règles que api/_lib/handlers/teacher-portal.js + portal-data.js, mais
// côté client (le portail enseignant lit désormais Supabase directement).
export function normalizeText(value = "") {
  return String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

function stripLegacyTeacherSuffix(value = "") {
  return String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function normalizeSection(section = "") {
  const s = String(section || "").trim().toLowerCase();
  if (s === "secondaire") return "college";
  return ["primaire", "college", "lycee"].includes(s) ? s : "college";
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
// Primaire : titulaire multi-matières → pas de filtre matière.
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
  if (normalizeText(section) !== "primaire") {
    if (!matiere) return false;
    if (normalizeText(note.matiere) !== normalizeText(matiere)) return false;
  }
  return true;
}
