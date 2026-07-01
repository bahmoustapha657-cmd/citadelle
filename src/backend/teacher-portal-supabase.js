// ── Portail enseignant via Supabase ─────────────────────────────────────────
// Remplace l'API serveur /teacher-portal. Réutilise l'adaptateur de collections
// (chargerCollection / ajouter / modifier / supprimer) puis applique le même
// filtrage de PÉRIMÈTRE que le handler (classes du prof → élèves → notes).
//
// ⚠️ Sécurité : la RLS Supabase autorise un enseignant (can_grade) à écrire
// N'IMPORTE quelle note de SON école — le périmètre fin (ses classes/matière)
// est ici filtré CÔTÉ CLIENT (affichage) mais PAS imposé à l'écriture, alors que
// le serveur le validait. À durcir via une table de mapping enseignant↔classes
// en RLS, ou une Edge Function. Acceptable pour la bascule ; à traiter ensuite.
import { chargerCollection, ajouterDoc, ajouterDocs, upsertDocs, modifierDoc, supprimerDoc } from "./data-supabase";
import { teacherAliases, matchesTeacherAlias, noteBelongsToTeacherScope, normalizeText, normalizeSection } from "./teacher-scope";

const CAP = { primaire: "Primaire", college: "College", lycee: "Lycee" };
let ctx = null; // contexte enseignant courant (rempli au fetch, utilisé aux écritures)

export async function fetchTeacherPortal(utilisateur) {
  const code = utilisateur.schoolId;
  const section = normalizeSection(utilisateur.section || utilisateur.sections?.[0] || "college");
  const C = CAP[section];
  const aliases = teacherAliases(utilisateur);
  ctx = {
    code, section, C, matiere: utilisateur.matiere || "",
    // Auteur des notes (le handler serveur les posait ; indispensable pour
    // tracer qui a saisi quoi côté École).
    enseignantId: utilisateur.enseignantId || null,
    enseignantNom: utilisateur.enseignantNom || utilisateur.nom || "",
  };

  const lire = async (nom) => (await chargerCollection(code, nom)).items;
  const [emploisAll, ensAll, classesAll, matieresAll, salairesAll, rosterAll] = await Promise.all([
    lire(`classes${C}_emplois`), lire(`ens${C}_enseignements`),
    lire(`classes${C}`), lire(`classes${C}_matieres`), lire("salaires"), lire(`ens${C}`),
  ]);

  const emplois = emploisAll.filter((i) => matchesTeacherAlias(i.enseignant, aliases));
  const enseignements = ensAll.filter((i) => matchesTeacherAlias(i.enseignantNom, aliases));

  // Classe(s) titulaire : fiche enseignant du registre (roster) — essentiel au
  // primaire (souvent ni EDT ni cahier de textes). On matche par id puis par nom,
  // et on récupère tous les champs « classe » plausibles de la fiche.
  const mesFiches = rosterAll.filter((f) =>
    (utilisateur.enseignantId && f._id === utilisateur.enseignantId)
    || matchesTeacherAlias(`${f.nom || ""} ${f.prenom || ""}`, aliases)
    || matchesTeacherAlias(f.nom, aliases));
  const titulaire = mesFiches.flatMap((f) => [f.classeTitle, f.classeTitre, f.classe, f.grade]);
  const parClasse = classesAll
    .filter((c) => c.enseignantId && c.enseignantId === utilisateur.enseignantId)
    .map((c) => c.nom);
  const profilClasses = [utilisateur.classeTitre, utilisateur.classe,
    ...(Array.isArray(utilisateur.classesTitulaire) ? utilisateur.classesTitulaire : [])];

  const classes = [...new Set([
    ...emplois.map((e) => e.classe), ...enseignements.map((e) => e.classe),
    ...titulaire, ...parClasse, ...profilClasses,
  ].filter(Boolean))];
  const classNorm = [...new Set(classes.map(normalizeText).filter(Boolean))];
  // Un élève est dans le périmètre si sa classe égale une classe du périmètre,
  // OU la prolonge (ex. titulaire « 4ème Année » → élèves « 4ème Année A/B »).
  const classeDansPerimetre = (classeEleve) => {
    const ce = normalizeText(classeEleve);
    return classNorm.some((s) => ce === s || ce.startsWith(`${s} `));
  };

  const elevesAll = await lire(`eleves${C}`);
  const eleves = elevesAll.filter((e) => classeDansPerimetre(e.classe));
  const studentIds = new Set(eleves.map((e) => String(e._id)));
  const studentNames = new Set(eleves.map((e) => normalizeText(`${e.prenom || ""} ${e.nom || ""}`)));
  const teacherClasses = new Set(eleves.map((e) => String(e.classe || "").trim()).filter(Boolean));

  const [notesAll, absAll] = await Promise.all([lire(`notes${C}`), lire(`eleves${C}_absences`)]);
  const notes = notesAll.filter((n) =>
    noteBelongsToTeacherScope(n, studentIds, utilisateur.matiere || "", studentNames, section, teacherClasses));
  const incidents = absAll.filter((i) => studentIds.has(String(i.eleveId || "").trim()));
  const matieres = matieresAll.filter((m) =>
    !Array.isArray(m.classes) || m.classes.length === 0
      ? true
      : m.classes.some((c) => classeDansPerimetre(c)));
  const salaires = salairesAll.filter((s) => matchesTeacherAlias(s.nom, aliases));

  return { section, matieres, emplois, eleves, notes, enseignements, salaires, incidents };
}

// ── Écriture des notes (réutilise les écritures de l'adaptateur) ───────────
function notesColl() {
  if (!ctx) throw new Error("Contexte enseignant absent — rechargez le portail.");
  return `notes${ctx.C}`;
}
// Secondaire : la matière du prof prime ; primaire : matière saisie (multi).
function matiereEffective(matiere) {
  return ctx?.section === "primaire" ? (matiere || "") : (ctx?.matiere || matiere || "");
}

// Payload complet d'une note (auteur inclus, comme le handler serveur).
function noteItem({ eleveId, type, periode, note, matiere, annee }) {
  return {
    eleveId, type, periode, note: Number(note),
    matiere: matiereEffective(matiere), annee: annee || "",
    enseignantId: ctx?.enseignantId || null,
    enseignantNom: ctx?.enseignantNom || "",
  };
}

export async function saveNote({ noteId, eleveId, type, periode, note, matiere, annee }) {
  const item = noteItem({ eleveId, type, periode, note, matiere, annee });
  if (noteId) await modifierDoc(ctx.code, notesColl(), { _id: noteId, ...item });
  else await ajouterDoc(ctx.code, notesColl(), item);
  return { ok: true, data: { ok: true } };
}

// Enregistrement par LOT (grille) : 2 requêtes max (insert groupé des
// créations + upsert groupé des mises à jour) au lieu de N écritures
// séquentielles. Renvoie { saved, failed, notes } comme le handler serveur,
// pour que le portail fusionne l'état local sans rechargement complet.
export async function saveNotes(notes) {
  const coll = notesColl();
  const creations = notes.filter((n) => !n.noteId).map(noteItem);
  const majs = notes.filter((n) => n.noteId).map((n) => ({ _id: n.noteId, ...noteItem(n) }));

  const savedNotes = [];
  let failed = 0;
  const erreurs = [];
  const tenter = async (fn, items) => {
    if (!items.length) return;
    try {
      savedNotes.push(...await fn(ctx.code, coll, items));
    } catch (e) {
      failed += items.length;
      erreurs.push(e.message);
    }
  };
  await Promise.all([tenter(ajouterDocs, creations), tenter(upsertDocs, majs)]);

  if (savedNotes.length === 0 && failed > 0) {
    // Échec réseau (aucune réponse serveur) → on RELÈVE pour que l'appelant
    // mette la saisie en file hors-ligne (voir enregistrerGrille). Un rejet
    // serveur (RLS, validation) renvoie ok:false, sans mise en file.
    const reseau = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;
    if (erreurs.every((m) => reseau.test(m || ""))) throw new Error(erreurs[0]);
    return { ok: false, data: { error: erreurs[0] || "Enregistrement impossible." } };
  }
  return { ok: true, data: { ok: true, saved: savedNotes.length, failed, notes: savedNotes } };
}

export async function deleteNote(noteId) {
  await supprimerDoc(ctx.code, notesColl(), noteId);
  return { ok: true, data: { ok: true } };
}

// ── Incidents / absences (table `absences`) ────────────────────────────────
function absencesColl() {
  if (!ctx) throw new Error("Contexte enseignant absent — rechargez le portail.");
  return `eleves${ctx.C}_absences`;
}

export async function saveIncident({ incidentId, eleveId, type, date, justifie, motif }) {
  const item = { eleveId, type, date, justifie: justifie || "Non", motif: motif || "" };
  if (incidentId) await modifierDoc(ctx.code, absencesColl(), { _id: incidentId, ...item });
  else await ajouterDoc(ctx.code, absencesColl(), item);
  return { ok: true };
}

export async function deleteIncident(incidentId) {
  await supprimerDoc(ctx.code, absencesColl(), incidentId);
  return { ok: true };
}
