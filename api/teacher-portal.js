import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  getDocsByFieldValues,
  getSectionCollections,
  getTeacherAliases,
  matchesTeacherAlias,
  normalizeSection,
  sortByDateDesc,
  toItem,
  uniqueById,
} from "./_lib/portal-data.js";
import { applyCors, normalizeSchoolId, requireSession } from "./_lib/security.js";

function getTeacherSection(profile = {}) {
  return normalizeSection(profile.section || profile.sections?.[0] || "college");
}

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function noteBelongsToTeacherScope(note = {}, studentIds = new Set(), matiere = "", studentNames = new Set()) {
  const noteStudentId = String(note.eleveId || "").trim();
  if (noteStudentId) {
    if (!studentIds.has(noteStudentId)) {
      return false;
    }
  } else {
    const noteStudentName = normalizeText(note.eleveNom);
    if (!noteStudentName || !studentNames.has(noteStudentName)) {
      return false;
    }
  }

  if (matiere && normalizeText(note.matiere) !== normalizeText(matiere)) {
    return false;
  }

  return true;
}

async function loadTeacherPortalPayload({ db, schoolId, profile }) {
  const schoolRef = db.collection("ecoles").doc(schoolId);
  const section = getTeacherSection(profile);
  const aliases = getTeacherAliases(profile);
  const collections = getSectionCollections(section);
  const [emploisSnap, enseignementsSnap, salairesSnap] = await Promise.all([
    schoolRef.collection(collections.emplois).get(),
    schoolRef.collection(collections.enseignements).get(),
    schoolRef.collection("salaires").get(),
  ]);

  const emplois = emploisSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.enseignant, aliases));
  const enseignements = enseignementsSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.enseignantNom, aliases));
  const salaires = salairesSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.nom, aliases));

  const classes = [...new Set(emplois.map((emploi) => emploi.classe).filter(Boolean))];
  const eleves = uniqueById(await getDocsByFieldValues(schoolRef.collection(collections.eleves), "classe", classes));
  const studentIds = new Set(eleves.map((student) => String(student._id || "").trim()).filter(Boolean));
  const studentNames = new Set(
    eleves
      .map((student) => normalizeText(`${student.prenom || ""} ${student.nom || ""}`))
      .filter(Boolean),
  );
  const rawNotes = (await schoolRef.collection(collections.notes).get()).docs.map(toItem);
  const notes = rawNotes.filter((note) => noteBelongsToTeacherScope(note, studentIds, profile.matiere || "", studentNames));

  return {
    section,
    emplois: sortByDateDesc(uniqueById(emplois), "updatedAt"),
    eleves,
    notes: sortByDateDesc(uniqueById(notes), "updatedAt"),
    enseignements: sortByDateDesc(uniqueById(enseignements), "date"),
    salaires: sortByDateDesc(uniqueById(salaires), "createdAt"),
  };
}

async function resolveTeacherScope({ db, schoolId, profile }) {
  const payload = await loadTeacherPortalPayload({ db, schoolId, profile });
    return {
      ...payload,
      studentIds: new Set(payload.eleves.map((student) => String(student._id || "").trim()).filter(Boolean)),
      studentNames: new Set(
        payload.eleves
          .map((student) => normalizeText(`${student.prenom || ""} ${student.nom || ""}`))
          .filter(Boolean),
      ),
    };
  }

export default async function handler(req, res) {
  if (!applyCors(req, res, "GET,POST,OPTIONS")) return;
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!["GET", "POST"].includes(req.method)) return res.status(405).end();

  try {
    initAdmin();
  } catch {
    return res.status(500).json({ error: "Erreur serveur (init)" });
  }

  const session = await requireSession(req, res, { roles: ["enseignant"] });
  if (!session) return;

  const db = getFirestore();
  const schoolId = normalizeSchoolId(session.profile.schoolId);
  const section = getTeacherSection(session.profile);
  const collections = getSectionCollections(section);

  if (req.method === "GET") {
    try {
      const payload = await loadTeacherPortalPayload({
        db,
        schoolId,
        profile: session.profile,
      });
      return res.status(200).json({ ok: true, ...payload });
    } catch (error) {
      console.error("teacher-portal get error:", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  const action = String(req.body?.action || "").trim();
  if (!["save_note", "delete_note"].includes(action)) {
    return res.status(400).json({ error: "Action inconnue." });
  }

  try {
    const teacherScope = await resolveTeacherScope({
      db,
      schoolId,
      profile: session.profile,
    });
    const notesRef = db.collection("ecoles").doc(schoolId).collection(collections.notes);

    if (action === "delete_note") {
      const noteId = String(req.body?.noteId || "").trim();
      if (!noteId) {
        return res.status(400).json({ error: "Champ requis : noteId" });
      }

      const noteSnap = await notesRef.doc(noteId).get();
      if (!noteSnap.exists) {
        return res.status(404).json({ error: "Note introuvable." });
      }

      const note = toItem(noteSnap);
      if (!noteBelongsToTeacherScope(note, teacherScope.studentIds, session.profile.matiere || "", teacherScope.studentNames)) {
        return res.status(403).json({ error: "Note hors perimetre pour cet enseignant." });
      }

      await noteSnap.ref.delete();
      return res.status(200).json({ ok: true });
    }

    const noteId = String(req.body?.noteId || "").trim();
    const eleveId = String(req.body?.eleveId || "").trim();
    const type = String(req.body?.type || "Devoir").trim();
    const periode = String(req.body?.periode || "").trim();
    const noteValue = Number(req.body?.note);
    const eleve = teacherScope.eleves.find((student) => student._id === eleveId);

    if (!eleveId || !eleve || !periode || !Number.isFinite(noteValue)) {
      return res.status(400).json({ error: "Champs requis : eleveId, periode, note" });
    }

    const payload = {
      eleveId,
      eleveNom: `${eleve.prenom || ""} ${eleve.nom || ""}`.trim(),
      matiere: session.profile.matiere || "",
      type,
      periode,
      note: noteValue,
      enseignantId: session.profile.enseignantId || null,
      enseignantNom: session.profile.enseignantNom || session.profile.nom || "",
      section,
      updatedAt: Date.now(),
    };

    if (noteId) {
      const noteSnap = await notesRef.doc(noteId).get();
      if (!noteSnap.exists) {
        return res.status(404).json({ error: "Note introuvable." });
      }

      const existingNote = toItem(noteSnap);
      if (!noteBelongsToTeacherScope(existingNote, teacherScope.studentIds, session.profile.matiere || "", teacherScope.studentNames)) {
        return res.status(403).json({ error: "Note hors perimetre pour cet enseignant." });
      }

      await noteSnap.ref.update(payload);
      return res.status(200).json({ ok: true, noteId });
    }

    const createdRef = await notesRef.add({
      ...payload,
      createdAt: Date.now(),
    });
    return res.status(200).json({ ok: true, noteId: createdRef.id });
  } catch (error) {
    console.error("teacher-portal post error:", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
