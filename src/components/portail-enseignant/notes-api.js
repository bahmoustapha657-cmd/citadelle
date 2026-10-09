// Notes du portail enseignant : sauvegarde et suppression.
// Renvoient { ok, data } sans lever, pour laisser l'appelant gérer l'UI.
import { saveNote, saveNotes, deleteNote } from "../../backend/teacher-portal-supabase";

// Crée ou met à jour une note (création si noteId vide). `matiere` n'est
// utilisée qu'au primaire (titulaire multi-matières) ; au secondaire, la
// matière de l'enseignant prime.
export function saveNoteApi({ noteId, eleveId, type, periode, note, matiere, annee }) {
  return saveNote({ noteId, eleveId, type, periode, note, matiere, annee });
}

// Enregistre PLUSIEURS notes en une seule fois. Bien plus rapide que N appels
// saveNoteApi pour la grille.
// `notes` : [{ noteId, eleveId, type, periode, note, matiere, annee }]. L'année
// est portée par chaque note pour survivre à la file de synchro hors-ligne.
export function saveNotesApi(notes) {
  return saveNotes(notes);
}

// Supprime une note.
export function deleteNoteApi(noteId) {
  return deleteNote(noteId);
}
