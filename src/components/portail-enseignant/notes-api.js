// Notes du portail enseignant : sauvegarde (unitaire ou groupée) et
// suppression. Simple façade depuis le retrait du chemin Vercel/Firebase
// (liquidation Firebase, lot 3).
//
// Deux règles métier que portait l'ancien serveur et que le module Supabase
// applique désormais :
//   • `matiere` ne sert qu'au PRIMAIRE (titulaire multi-matières) ; au
//     secondaire, la matière de l'enseignant prime.
//   • `saveNotes` enregistre la grille en UN appel plutôt que N — l'année est
//     portée par chaque note, pour survivre à la file de synchro hors-ligne.
export {
  saveNote as saveNoteApi,
  saveNotes as saveNotesApi,
  deleteNote as deleteNoteApi,
} from "../../backend/teacher-portal-supabase";
