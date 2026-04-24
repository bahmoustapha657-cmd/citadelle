import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_lib/firebase-admin.js";
import {
  filterParentStudents,
  getDocsByFieldValues,
  getDocsByIds,
  getProfileStudentIds,
  getSectionCollections,
  normalizeSection,
  sortByDateDesc,
  toItem,
  uniqueById,
} from "./_lib/portal-data.js";
import { applyCors, normalizeSchoolId, requireSession } from "./_lib/security.js";

function getStudentNames(students = []) {
  return [...new Set(
    students
      .map((student) => `${student.prenom || ""} ${student.nom || ""}`.trim())
      .filter(Boolean),
  )];
}

function getParentSections(profile = {}) {
  const sections = Array.isArray(profile.sections) && profile.sections.length > 0
    ? profile.sections
    : [profile.section];

  return [...new Set(sections.map((section) => normalizeSection(section)).filter(Boolean))];
}

async function loadParentStudents({ db, schoolId, profile, section }) {
  const schoolRef = db.collection("ecoles").doc(schoolId);
  const { eleves } = getSectionCollections(section);
  const elevesRef = schoolRef.collection(eleves);
  const explicitIds = getProfileStudentIds(profile);
  const linkedById = await getDocsByIds(elevesRef, explicitIds);
  const linkedStudents = filterParentStudents(profile, linkedById, section);
  const hasLegacyLink = (profile.elevesAssocies || []).some((entry) => !entry?.eleveId);

  if (!hasLegacyLink) {
    return linkedStudents;
  }

  const allStudents = (await elevesRef.get()).docs.map(toItem);
  return uniqueById([
    ...linkedStudents,
    ...filterParentStudents(profile, allStudents, section),
  ]);
}

async function loadParentSectionData({ db, schoolId, profile, section }) {
  const schoolRef = db.collection("ecoles").doc(schoolId);
  const collections = getSectionCollections(section);
  const students = await loadParentStudents({ db, schoolId, profile, section });
  const studentIds = getProfileStudentIds(profile, students);
  const studentNames = getStudentNames(students);
  const classes = [...new Set(students.map((student) => student.classe).filter(Boolean))];

  const [notesById, notesByName, absencesById, absencesByName, messagesById, messagesByName, tarifs] = await Promise.all([
    getDocsByFieldValues(schoolRef.collection(collections.notes), "eleveId", studentIds),
    getDocsByFieldValues(schoolRef.collection(collections.notes), "eleveNom", studentNames),
    getDocsByFieldValues(schoolRef.collection(`${collections.eleves}_absences`), "eleveId", studentIds),
    getDocsByFieldValues(schoolRef.collection(`${collections.eleves}_absences`), "eleveNom", studentNames),
    getDocsByFieldValues(schoolRef.collection("messages"), "eleveId", studentIds),
    getDocsByFieldValues(schoolRef.collection("messages"), "eleveNom", studentNames),
    getDocsByFieldValues(schoolRef.collection("tarifs"), "classe", classes),
  ]);

  return {
    section,
    eleves: students.map((student) => ({ ...student, section })),
    notes: uniqueById([...notesById, ...notesByName]),
    absences: uniqueById([...absencesById, ...absencesByName]),
    messages: uniqueById([...messagesById, ...messagesByName]),
    tarifs,
  };
}

async function loadParentPortalPayload({ db, schoolId, profile }) {
  const schoolRef = db.collection("ecoles").doc(schoolId);
  const sections = getParentSections(profile);
  const sectionPayloads = await Promise.all(
    sections.map((section) => loadParentSectionData({ db, schoolId, profile, section })),
  );
  const annoncesSnap = await schoolRef.collection("annonces").orderBy("date", "desc").limit(10).get();

  return {
    eleves: uniqueById(sectionPayloads.flatMap((payload) => payload.eleves)),
    notes: sortByDateDesc(uniqueById(sectionPayloads.flatMap((payload) => payload.notes)), "date"),
    absences: sortByDateDesc(uniqueById(sectionPayloads.flatMap((payload) => payload.absences)), "date"),
    messages: sortByDateDesc(uniqueById(sectionPayloads.flatMap((payload) => payload.messages)), "date"),
    tarifs: uniqueById(sectionPayloads.flatMap((payload) => payload.tarifs)),
    annonces: annoncesSnap.docs.map(toItem),
  };
}

async function resolveParentStudent({ db, schoolId, profile, eleveId }) {
  const payload = await loadParentPortalPayload({ db, schoolId, profile });
  return payload.eleves.find((student) => student._id === eleveId) || null;
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

  const session = await requireSession(req, res, { roles: ["parent"] });
  if (!session) return;

  const db = getFirestore();
  const schoolId = normalizeSchoolId(session.profile.schoolId);

  if (req.method === "GET") {
    try {
      const payload = await loadParentPortalPayload({
        db,
        schoolId,
        profile: session.profile,
      });
      return res.status(200).json({ ok: true, ...payload });
    } catch (error) {
      console.error("parent-portal get error:", error);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  }

  const eleveId = String(req.body?.eleveId || "").trim();
  const sujet = String(req.body?.sujet || "").trim();
  const corps = String(req.body?.corps || "").trim();

  if (!eleveId || !sujet || !corps) {
    return res.status(400).json({ error: "Champs requis : eleveId, sujet, corps" });
  }

  try {
    const student = await resolveParentStudent({
      db,
      schoolId,
      profile: session.profile,
      eleveId,
    });

    if (!student) {
      return res.status(403).json({ error: "Eleve introuvable pour ce compte parent." });
    }

    await db.collection("ecoles").doc(schoolId).collection("messages").add({
      expediteur: "parent",
      expediteurNom: session.profile.nom || session.profile.tuteur || "Parent",
      expediteurLogin: session.profile.login || "",
      eleveId: student._id,
      eleveNom: `${student.prenom || ""} ${student.nom || ""}`.trim(),
      sujet,
      corps,
      lu: false,
      date: Date.now(),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("parent-portal post error:", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}
