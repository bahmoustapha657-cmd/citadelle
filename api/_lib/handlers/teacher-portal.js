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
import { applyCors, isSchoolReadOnly, normalizeSchoolId, requireSession } from "../security.js";
import { captureServerError, withObservability } from "../observability.js";

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
//
// F2 (homonymie eleveNom) — durcissement 2026-05-12 : si la note n'a pas d'eleveId,
// on tombe sur le fallback eleveNom. Pour éviter qu'un homonyme inter-classes ne
// fuite, on exige désormais que `note.classe` corresponde à une classe du périmètre
// enseignant (paramètre teacherClasses). Sans classe sur la note ou classe hors
// scope → refus, même si le nom matche.
export function noteBelongsToTeacherScope(note = {}, studentIds = new Set(), matiere = "", studentNames = new Set(), section = "college", teacherClasses = null) {
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
    // Durcissement F2 : exiger une classe explicite dans le scope si fourni.
    if (teacherClasses instanceof Set && teacherClasses.size > 0) {
      const noteClasse = String(note.classe || "").trim();
      if (!noteClasse || !teacherClasses.has(noteClasse)) {
        return false;
      }
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
  const [emploisSnap, enseignementsSnap, salairesSnap, absencesSnap, rosterSnap, classesSnap] = await Promise.all([
    schoolRef.collection(collections.emplois).get(),
    schoolRef.collection(collections.enseignements).get(),
    schoolRef.collection("salaires").get(),
    schoolRef.collection(absencesCollName).get(),
    schoolRef.collection(collections.roster).get(),
    schoolRef.collection(collections.classes).get(),
  ]);

  const emplois = emploisSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.enseignant, aliases));
  const enseignements = enseignementsSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.enseignantNom, aliases));
  const salaires = salairesSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.nom, aliases));

  // Registre des enseignants : classe(s) dont le prof est TITULAIRE
  // (essentiel au primaire, où il n'y a souvent ni EDT ni cahier de textes).
  // Le nom du registre est "Prénom Nom".
  const monRoster = rosterSnap.docs.map(toItem).filter((r) =>
    matchesTeacherAlias(`${r.prenom || ""} ${r.nom || ""}`, aliases) || matchesTeacherAlias(r.enseignantNom, aliases));
  // Classes qui désignent ce prof comme enseignant/titulaire (champ posé par
  // la fiche enseignant lorsqu'une classe titulaire est renseignée).
  const mesClassesTitulaire = classesSnap.docs.map(toItem).filter((c) => matchesTeacherAlias(c.enseignant, aliases));

  // Classes de l'enseignant = UNION de toutes ses sources d'affectation,
  // pas seulement l'emploi du temps (souvent incomplet). Avant, un prof
  // ayant des matières assignées (enseignements) mais pas d'EDT ne voyait
  // AUCUN élève. On ajoute donc les classes du cahier de textes
  // (enseignements) et la/les classe(s) dont il est titulaire.
  const classesTitulaire = [
    profile.classeTitle, profile.classeTitre, profile.classe,
    ...(Array.isArray(profile.classesTitulaire) ? profile.classesTitulaire : []),
  ];
  const classes = [...new Set([
    ...emplois.map((emploi) => emploi.classe),
    ...enseignements.map((ens) => ens.classe),
    ...monRoster.map((r) => r.classeTitle),
    ...mesClassesTitulaire.map((c) => c.nom),
    ...classesTitulaire,
  ].map((c) => String(c || "").trim()).filter(Boolean))];
  const teacherClasses = new Set(classes);
  const eleves = uniqueById(await getDocsByFieldValues(schoolRef.collection(collections.eleves), "classe", classes));
  const studentIds = new Set(eleves.map((student) => String(student._id || "").trim()).filter(Boolean));
  const studentNames = new Set(
    eleves
      .map((student) => normalizeText(`${student.prenom || ""} ${student.nom || ""}`))
      .filter(Boolean),
  );
  const rawNotes = (await schoolRef.collection(collections.notes).get()).docs.map(toItem);
  const notes = rawNotes.filter((note) => noteBelongsToTeacherScope(note, studentIds, profile.matiere || "", studentNames, section, teacherClasses));

  // Incidents (absences/retard/indiscipline) sur les élèves dans le scope
  // de l'enseignant. Filtrage par eleveId de préférence, fallback eleveNom +
  // classe (durcissement F2 2026-05-12) pour les anciens enregistrements.
  const incidents = absencesSnap.docs.map(toItem).filter((inc) => {
    const incId = String(inc.eleveId || "").trim();
    if (incId) return studentIds.has(incId);
    const incName = normalizeText(inc.eleveNom);
    if (!incName || !studentNames.has(incName)) return false;
    const incClasse = String(inc.classe || "").trim();
    return !!incClasse && teacherClasses.has(incClasse);
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
      teacherClasses: new Set(payload.eleves.map((student) => String(student.classe || "").trim()).filter(Boolean)),
    };
  }

async function handler(req, res) {
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

  // Abonnement expire (apres grace) => etablissement en lecture seule : toute
  // ecriture passant par l'Admin SDK (qui contourne firestore.rules) est refusee
  // ici aussi. Cf. isSchoolReadOnly / abonnementActif (firestore.rules).
  if (await isSchoolReadOnly(db, schoolId)) {
    return res.status(403).json({
      error: "Abonnement expiré : l'établissement est en lecture seule. Contactez la direction.",
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
      // Trace d'audit : contenu intégral du signalement supprimé.
      const { _id: _incId, ...incDonnees } = inc;
      await db.collection("ecoles").doc(schoolId).collection("historique").add({
        action: "Suppression — Signalement (portail enseignant)",
        details: `${inc.eleveNom || ""} · ${inc.type || ""} · ${inc.date || ""}`.trim(),
        auteur: session.profile.enseignantNom || session.profile.nom || "Enseignant",
        date: Date.now(),
        suppression: { collection: `${collections.eleves}_absences`, docId: incidentId, donnees: incDonnees },
      }).catch(() => {});
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
      if (!noteBelongsToTeacherScope(note, teacherScope.studentIds, session.profile.matiere || "", teacherScope.studentNames, section, teacherScope.teacherClasses)) {
        return res.status(403).json({ error: "Note hors perimetre pour cet enseignant." });
      }

      await noteSnap.ref.delete();
      // Trace d'audit : contenu intégral de la note supprimée.
      const { _id: _noteId, ...noteDonnees } = note;
      await db.collection("ecoles").doc(schoolId).collection("historique").add({
        action: "Suppression — Note (portail enseignant)",
        details: `${note.eleveNom || ""} · ${note.matiere || ""} · ${note.periode || ""} · note : ${note.note ?? "—"}`,
        auteur: session.profile.enseignantNom || session.profile.nom || "Enseignant",
        date: Date.now(),
        suppression: { collection: collections.notes, docId: noteId, donnees: noteDonnees },
      }).catch(() => {});
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

    // Barème : le portail enseignant écrit via l'Admin SDK (les règles client
    // ne s'appliquent pas) — on refuse toute note hors 0..maxNote pour ne pas
    // corrompre moyennes et bulletins (primaire /10, secondaire /20).
    const maxNote = section === "primaire" ? 10 : 20;
    if (noteValue < 0 || noteValue > maxNote) {
      return res.status(400).json({ error: `Note invalide : doit être comprise entre 0 et ${maxNote}.` });
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
    await captureServerError(error, { endpoint: "teacher-portal" });
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

export default withObservability(handler);
