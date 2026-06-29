// Appels réseau /teacher-portal pour les notes : sauvegarde et suppression.
// Renvoient { ok, data } sans lever, pour laisser l'appelant gérer l'UI.
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { isSupabase } from "../../backend";
import { saveNote, saveNotes, deleteNote } from "../../backend/teacher-portal-supabase";

async function postTeacherPortal(body) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await apiFetch("/teacher-portal", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok, data };
}

// Crée ou met à jour une note (création si noteId vide). `matiere` n'est
// utilisée par le serveur qu'au primaire (titulaire multi-matières) ;
// au secondaire, la matière de l'enseignant prime.
export function saveNoteApi({ noteId, eleveId, type, periode, note, matiere, annee }) {
  if (isSupabase) return saveNote({ noteId, eleveId, type, periode, note, matiere, annee });
  return postTeacherPortal({ action: "save_note", noteId: noteId || "", eleveId, type, periode, note, matiere: matiere || "", annee: annee || "" });
}

// Enregistre PLUSIEURS notes en une seule requête (écriture Firestore batchée
// côté serveur). Bien plus rapide que N appels saveNoteApi pour la grille.
// `notes` : [{ noteId, eleveId, type, periode, note, matiere, annee }]. L'année
// est portée par chaque note pour survivre à la file de synchro hors-ligne.
export function saveNotesApi(notes) {
  if (isSupabase) return saveNotes(notes);
  return postTeacherPortal({
    action: "save_notes",
    notes: notes.map((n) => ({
      noteId: n.noteId || "",
      eleveId: n.eleveId,
      type: n.type,
      periode: n.periode,
      note: n.note,
      matiere: n.matiere || "",
      annee: n.annee || "",
    })),
  });
}

// Supprime une note.
export function deleteNoteApi(noteId) {
  if (isSupabase) return deleteNote(noteId);
  return postTeacherPortal({ action: "delete_note", noteId });
}
