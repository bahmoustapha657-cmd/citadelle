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

// Section inscrite sur le compte d'un enseignant créé depuis le module École
// (prop `section` d'Ecole). La maternelle y reste « primaire » : ni ce
// portail (normalizeSection ci-dessus, CAP de teacher-portal-supabase.js),
// ni l'Edge Function account-manage (la Direction primaire n'y crée que des
// enseignants « primaire »), ni la RLS teacher_can_write_note (seul
// « primaire » y est dispensé du filtre matière) ne connaissent encore
// « prescolaire ». Seul, ce changement ferait refuser la création (403) et
// lire au portail les collections du COLLÈGE : à basculer avec eux.
export function teacherAccountSection(section = "") {
  return section === "prescolaire" ? "primaire" : section;
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
