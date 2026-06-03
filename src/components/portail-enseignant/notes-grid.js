// Helpers purs de la grille de saisie des notes (portail enseignant) :
// pré-remplissage, collecte des cellules saisies et validation.
import { resolveCanonicalNoteType } from "../../evaluation-forms";

// Pré-remplit la grille pour un trio (classe, type, période) à partir des
// notes existantes par élève.
export function construireGrille({ classe, type, periode, eleves, mesNotes, schoolInfo, utilisateur }) {
  const section = utilisateur.section || "secondaire";
  const map = {};
  eleves
    .filter((e) => e.classe === classe)
    .forEach((e) => {
      const existante = mesNotes.find(
        (n) => n.eleveId === e._id && n.periode === periode && resolveCanonicalNoteType(n.type, schoolInfo, section) === type,
      );
      map[e._id] = existante ? String(existante.note ?? "") : "";
    });
  return map;
}

// Construit la liste des notes à sauvegarder (cellules non vides), avec le
// type canonique et l'éventuel noteId existant.
export function collectGridNotes({ gridForm, mesNotes, schoolInfo, utilisateur }) {
  const section = utilisateur.section || "secondaire";
  const canonical = resolveCanonicalNoteType(gridForm.type, schoolInfo, section);
  const aSauver = Object.entries(gridForm.notes)
    .filter(([, val]) => val !== "" && val != null)
    .map(([eleveId, val]) => {
      const existante = mesNotes.find(
        (n) => n.eleveId === eleveId && n.periode === gridForm.periode && resolveCanonicalNoteType(n.type, schoolInfo, section) === canonical,
      );
      return { eleveId, note: Number(val), noteId: existante?._id || "" };
    });
  return { canonical, aSauver };
}

// Valide une liste de notes. Renvoie un message d'erreur ou null si valide.
export function validateGridNotes(aSauver) {
  if (aSauver.length === 0) return "Saisis au moins une note avant d'enregistrer.";
  const invalide = aSauver.find((n) => !Number.isFinite(n.note) || n.note < 0 || n.note > 20);
  if (invalide) return "Note invalide détectée (doit être un nombre entre 0 et 20).";
  return null;
}
