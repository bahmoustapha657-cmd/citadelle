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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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
  const [emploisSnap, enseignementsSnap, salairesSnap, rosterSnap, classesSnap, matieresSnap] = await Promise.all([
    schoolRef.collection(collections.emplois).get(),
    schoolRef.collection(collections.enseignements).get(),
    schoolRef.collection("salaires").get(),
    schoolRef.collection(collections.roster).get(),
    schoolRef.collection(collections.classes).get(),
    schoolRef.collection(`${collections.classes}_matieres`).get(),
  ]);

  const emplois = emploisSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.enseignant, aliases));
  const enseignements = enseignementsSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.enseignantNom, aliases));
  const salaires = salairesSnap.docs.map(toItem).filter((item) => matchesTeacherAlias(item.nom, aliases));

  // Registre des enseignants : classe(s) dont le prof est TITULAIRE
  // (essentiel au primaire, où il n'y a souvent ni EDT ni cahier de textes).
  // Le compte enseignant porte `enseignantId` = l'_id de SA fiche dans le
  // registre : on matche PAR ID en priorité (infaillible), puis par nom
  // "Prénom Nom" en repli (anciens comptes sans enseignantId). Sans cela, un
  // nom de compte légèrement différent (civilité, ordre prénom/nom) empêchait
  // de retrouver la classe titulaire → aucun élève au primaire.
  const enseignantId = String(profile.enseignantId || "").trim();
  const monRoster = rosterSnap.docs.map(toItem).filter((r) =>
    (enseignantId && String(r._id) === enseignantId)
    || matchesTeacherAlias(`${r.prenom || ""} ${r.nom || ""}`, aliases)
    || matchesTeacherAlias(r.enseignantNom, aliases));
  // Classes qui désignent ce prof comme enseignant/titulaire (champ posé par
  // la fiche enseignant lorsqu'une classe titulaire est renseignée).
  const mesClassesTitulaire = classesSnap.docs.map(toItem).filter((c) =>
    (enseignantId && String(c.enseignantId || "") === enseignantId)
    || matchesTeacherAlias(c.enseignant, aliases));

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
  const teacherClassesNorm = new Set(classes.map((c) => normalizeText(c)));

  // Matières applicables aux classes du prof (pour le primaire : le titulaire
  // saisit toutes les matières de sa classe). Une matière s'applique à une
  // classe si elle n'a pas de liste `classes` ou si elle la contient. La
  // comparaison est normalisée (casse / accents / espaces) pour les mêmes
  // raisons que la résolution des élèves.
  const matieres = uniqueById(matieresSnap.docs.map(toItem)).filter((mat) => {
    if (!Array.isArray(mat.classes) || mat.classes.length === 0) return true;
    return mat.classes.some((c) => teacherClassesNorm.has(normalizeText(c)));
  });

  // Récupération robuste des élèves : on compare les noms de classe de façon
  // normalisée (casse / accents / espaces). Une égalité stricte Firestore
  // ratait les élèves dès qu'un libellé différait un tant soit peu de la classe
  // du titulaire (ex. « 3ème Année A » vs « 3eme annee A ») — fréquent au
  // primaire où la classe du titulaire est saisie à la main.
  // Lecture CIBLÉE des élèves par classe (requête `where classe in …`) au lieu
  // de lire TOUTE la collection : c'était la principale source de lectures
  // Firestore (et de depassement de quota). Repli sur lecture complète + filtre
  // normalisé UNIQUEMENT si la requête ciblée ne renvoie rien (libellés de
  // classe divergents — cas rare).
  const classSet = new Set(classes.map((c) => normalizeText(c)).filter(Boolean));
  let eleves = uniqueById(await getDocsByFieldValues(schoolRef.collection(collections.eleves), "classe", classes));
  if (eleves.length === 0 && classes.length > 0) {
    const allEleves = (await schoolRef.collection(collections.eleves).get()).docs.map(toItem);
    eleves = uniqueById(allEleves.filter((el) => classSet.has(normalizeText(el.classe))));
  }
  const studentIds = new Set(eleves.map((student) => String(student._id || "").trim()).filter(Boolean));
  const studentNames = new Set(
    eleves
      .map((student) => normalizeText(`${student.prenom || ""} ${student.nom || ""}`))
      .filter(Boolean),
  );
  // Lecture CIBLÉE des notes par eleveId (au lieu de toute la collection notes).
  // On ne lit que les notes des élèves du périmètre de l'enseignant.
  const rawNotes = uniqueById(await getDocsByFieldValues(schoolRef.collection(collections.notes), "eleveId", [...studentIds]));
  const notes = rawNotes.filter((note) => noteBelongsToTeacherScope(note, studentIds, profile.matiere || "", studentNames, section, teacherClasses));

  // Incidents (absences/retard/indiscipline) : lecture CIBLÉE par eleveId au
  // lieu de toute la collection. Les anciens incidents sans eleveId (matchés
  // par nom) ne remontent plus — cas rare, acceptable face au quota.
  const incidentsRaw = uniqueById(await getDocsByFieldValues(schoolRef.collection(absencesCollName), "eleveId", [...studentIds]));
  const incidents = incidentsRaw.filter((inc) => studentIds.has(String(inc.eleveId || "").trim()));

  return {
    section,
    matieres,
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
  const NOTE_ACTIONS = ["save_note", "save_notes", "delete_note"];
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

    // ── Enregistrement par LOT (grille) ────────────────────────────────────
    // Une seule requête + écritures Firestore batchées : remplace N appels
    // save_note (un par cellule), qui rendaient la grille très lente.
    if (action === "save_notes") {
      const rawNotes = Array.isArray(req.body?.notes) ? req.body.notes : [];
      if (rawNotes.length === 0) {
        return res.status(400).json({ error: "Aucune note à enregistrer." });
      }
      if (rawNotes.length > 2000) {
        return res.status(400).json({ error: "Trop de notes en une fois (max 2000)." });
      }
      const maxNote = section === "primaire" ? 10 : 20;

      // Pré-chargement des notes existantes (mises à jour) en un seul getAll.
      const ids = [...new Set(rawNotes.map((n) => String(n?.noteId || "").trim()).filter(Boolean))];
      const existingById = new Map();
      if (ids.length) {
        const snaps = await db.getAll(...ids.map((id) => notesRef.doc(id)));
        snaps.forEach((snap) => { if (snap.exists) existingById.set(snap.id, toItem(snap)); });
      }

      const now = Date.now();
      let writeBatch = db.batch();
      let pending = 0;
      let saved = 0;
      let failed = 0;
      const commits = [];

      for (const raw of rawNotes) {
        const noteId = String(raw?.noteId || "").trim();
        const eleveId = String(raw?.eleveId || "").trim();
        const type = String(raw?.type || "Devoir").trim();
        const periode = String(raw?.periode || "").trim();
        const noteValue = Number(raw?.note);
        const eleve = teacherScope.eleves.find((s) => s._id === eleveId);

        if (!eleveId || !eleve || !periode || !Number.isFinite(noteValue)) { failed++; continue; }
        if (noteValue < 0 || noteValue > maxNote) { failed++; continue; }

        let matiereNote = session.profile.matiere || "";
        if (section === "primaire") {
          matiereNote = String(raw?.matiere || "").trim();
          if (!matiereNote) { failed++; continue; }
        }

        const payload = {
          eleveId,
          eleveNom: `${eleve.prenom || ""} ${eleve.nom || ""}`.trim(),
          matiere: matiereNote,
          type,
          periode,
          note: noteValue,
          // Année scolaire (réglage client) : indispensable pour que les
          // bulletins/archives synchronisent ces notes comme celles saisies
          // côté École (qui posent toujours `annee`).
          annee: String(raw?.annee || "").trim() || "2025-2026",
          enseignantId: session.profile.enseignantId || null,
          enseignantNom: session.profile.enseignantNom || session.profile.nom || "",
          section,
          updatedAt: now,
        };

        if (noteId) {
          const existing = existingById.get(noteId);
          // Anti-tamper : on ne met à jour qu'une note déjà dans le périmètre.
          if (!existing || !noteBelongsToTeacherScope(existing, teacherScope.studentIds, session.profile.matiere || "", teacherScope.studentNames, section, teacherScope.teacherClasses)) {
            failed++;
            continue;
          }
          writeBatch.update(notesRef.doc(noteId), payload);
        } else {
          writeBatch.set(notesRef.doc(), { ...payload, createdAt: now });
        }
        saved++;
        pending++;
        // Firestore limite chaque batch à 500 opérations.
        if (pending >= 450) {
          commits.push(writeBatch.commit());
          writeBatch = db.batch();
          pending = 0;
        }
      }
      if (pending > 0) commits.push(writeBatch.commit());
      await Promise.all(commits);

      return res.status(200).json({ ok: true, saved, failed });
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

    // Matière de la note. Au secondaire l'enseignant a UNE matière (profil).
    // Au primaire le titulaire saisit toutes les matières de sa classe → la
    // matière vient de la requête (obligatoire). Le périmètre élève reste
    // vérifié par teacherScope (au primaire, le scope note ignore la matière).
    let matiereNote = session.profile.matiere || "";
    if (section === "primaire") {
      matiereNote = String(req.body?.matiere || "").trim();
      if (!matiereNote) {
        return res.status(400).json({ error: "Champ requis : matiere (sélectionnez la matière)." });
      }
    }

    const payload = {
      eleveId,
      eleveNom: `${eleve.prenom || ""} ${eleve.nom || ""}`.trim(),
      matiere: matiereNote,
      type,
      periode,
      note: noteValue,
      annee: String(req.body?.annee || "").trim() || "2025-2026",
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
