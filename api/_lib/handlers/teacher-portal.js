import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "../firebase-admin.js";
import {
  getDocsByFieldValues,
  getSectionCollections,
  getTeacherAliases,
  matchesTeacherAlias,
  normalizeSection,
  sortByDateDesc,
  toItem,
  uniqueById,
} from "../portal-data.js";
import { applyCors, normalizeSchoolId, requireSession } from "../security.js";

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

// Restreint le périmètre d'une note à la classe ET à la matière de l'enseignant.
// Primaire : un titulaire enseigne toutes les matières de sa classe → pas de filtre matière.
// Secondaire (college/lycee) : la matière du profil est OBLIGATOIRE ; absente → refus.
// Sans cela un enseignant secondaire mal configuré (matière vide) verrait/modifierait
// toutes les notes de toutes les matières de ses classes.
export function noteBelongsToTeacherScope(note = {}, studentIds = new Set(), matiere = "", studentNames = new Set(), section = "college") {
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

  const normalizedSection = normalizeText(section);
  if (normalizedSection !== "primaire") {
    if (!matiere) return false;
    if (normalizeText(note.matiere) !== normalizeText(matiere)) return false;
  }

  return true;
}

async function loadTeacherPortalPayload({ db, schoolId, profile }) {
  const schoolRef = db.collection("ecoles").doc(schoolId);
  const section = getTeacherSection(profile);
  const aliases = getTeacherAliases(profile);
  const collections = getSectionCollections(section);
  const absencesCollName = `${collections.eleves}_absences`;
  const [emploisSnap, enseignementsSnap, salairesSnap, absencesSnap] = await Promise.all([
    schoolRef.collection(collections.emplois).get(),
    schoolRef.collection(collections.enseignements).get(),
    schoolRef.collection("salaires").get(),
    schoolRef.collection(absencesCollName).get(),
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
  const notes = rawNotes.filter((note) => noteBelongsToTeacherScope(note, studentIds, profile.matiere || "", studentNames, section));

  // Incidents (absences/retard/indiscipline) sur les élèves dans le scope
  // de l'enseignant. Filtrage par eleveId de préférence, fallback eleveNom
  // pour les anciens enregistrements créés sans id explicite.
  const incidents = absencesSnap.docs.map(toItem).filter((inc) => {
    const incId = String(inc.eleveId || "").trim();
    if (incId) return studentIds.has(incId);
    const incName = normalizeText(inc.eleveNom);
    return incName && studentNames.has(incName);
  });

  return {
    section,
    emplois: sortByDateDesc(uniqueById(emplois), "updatedAt"),
    eleves,
    notes: sortByDateDesc(uniqueById(notes), "updatedAt"),
    enseignements: sortByDateDesc(uniqueById(enseignements), "date"),
    salaires: sortByDateDesc(uniqueById(salaires), "createdAt"),
    incidents: sortByDateDesc(uniqueById(incidents), "date"),
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
  const NOTE_ACTIONS = ["save_note", "delete_note"];
  const INCIDENT_ACTIONS = ["save_incident", "delete_incident"];
  if (![...NOTE_ACTIONS, ...INCIDENT_ACTIONS].includes(action)) {
    return res.status(400).json({ error: "Action inconnue." });
  }

  // Échec sécurisé : un enseignant secondaire (college/lycee) doit avoir une
  // matière définie pour saisir des notes. Le filtre matière ne s'applique
  // pas aux incidents (un incident est lié à l'élève, pas à une discipline).
  if (NOTE_ACTIONS.includes(action) && section !== "primaire" && !session.profile.matiere) {
    return res.status(403).json({
      error: "Profil enseignant incomplet : la matière n'est pas définie. Contactez la direction.",
    });
  }

  try {
    const teacherScope = await resolveTeacherScope({
      db,
      schoolId,
      profile: session.profile,
    });
    const notesRef = db.collection("ecoles").doc(schoolId).collection(collections.notes);
    const absencesRef = db.collection("ecoles").doc(schoolId).collection(`${collections.eleves}_absences`);

    // ── Incidents (absence, retard, indiscipline, sanction) ────────────────
    if (action === "delete_incident") {
      const incidentId = String(req.body?.incidentId || "").trim();
      if (!incidentId) {
        return res.status(400).json({ error: "Champ requis : incidentId" });
      }
      const incSnap = await absencesRef.doc(incidentId).get();
      if (!incSnap.exists) {
        return res.status(404).json({ error: "Incident introuvable." });
      }
      const inc = toItem(incSnap);
      // L'enseignant ne peut supprimer que les incidents qu'il a lui-même
      // créés (signaledByEnseignantId). Les incidents saisis par la direction
      // sont protégés.
      const enseignantId = session.profile.enseignantId || null;
      if (!enseignantId || inc.signaledByEnseignantId !== enseignantId) {
        return res.status(403).json({ error: "Vous ne pouvez supprimer que vos propres signalements." });
      }
      // Vérification scope : l'élève doit toujours être dans son périmètre.
      const incEleveId = String(inc.eleveId || "").trim();
      if (incEleveId && !teacherScope.studentIds.has(incEleveId)) {
        return res.status(403).json({ error: "Élève hors périmètre." });
      }
      await incSnap.ref.delete();
      return res.status(200).json({ ok: true });
    }

    if (action === "save_incident") {
      const incidentId = String(req.body?.incidentId || "").trim();
      const eleveId = String(req.body?.eleveId || "").trim();
      const type = String(req.body?.type || "").trim();
      const date = String(req.body?.date || "").trim();
      const justifie = String(req.body?.justifie || "Non").trim();
      const motif = String(req.body?.motif || "").trim();
      const TYPES_AUTORISES = ["Absence", "Retard", "Sanction", "Avertissement", "Renvoi temporaire"];
      const eleve = teacherScope.eleves.find((s) => s._id === eleveId);

      if (!eleveId || !eleve) {
        return res.status(400).json({ error: "Élève hors périmètre ou introuvable." });
      }
      if (!TYPES_AUTORISES.includes(type)) {
        return res.status(400).json({ error: "Type de signalement invalide." });
      }
      if (!date) {
        return res.status(400).json({ error: "Date requise." });
      }

      const enseignantNom = session.profile.enseignantNom || session.profile.nom || "";
      const payload = {
        eleveId,
        eleveNom: `${eleve.prenom || ""} ${eleve.nom || ""}`.trim(),
        classe: eleve.classe || "",
        type,
        date,
        justifie: justifie === "Oui" ? "Oui" : "Non",
        motif,
        matiere: session.profile.matiere || "",
        signaledByEnseignantId: session.profile.enseignantId || null,
        signaledByEnseignantNom: enseignantNom,
        updatedAt: Date.now(),
      };

      if (incidentId) {
        const incSnap = await absencesRef.doc(incidentId).get();
        if (!incSnap.exists) {
          return res.status(404).json({ error: "Incident introuvable." });
        }
        const existing = toItem(incSnap);
        if (existing.signaledByEnseignantId !== payload.signaledByEnseignantId) {
          return res.status(403).json({ error: "Vous ne pouvez modifier que vos propres signalements." });
        }
        await incSnap.ref.update(payload);
        return res.status(200).json({ ok: true, incidentId });
      }

      const created = await absencesRef.add({ ...payload, createdAt: Date.now() });
      return res.status(200).json({ ok: true, incidentId: created.id });
    }

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
      if (!noteBelongsToTeacherScope(note, teacherScope.studentIds, session.profile.matiere || "", teacherScope.studentNames, section)) {
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
      if (!noteBelongsToTeacherScope(existingNote, teacherScope.studentIds, session.profile.matiere || "", teacherScope.studentNames, section)) {
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
