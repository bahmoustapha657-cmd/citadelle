// Helpers purs de la grille de saisie des notes (portail enseignant) :
// pré-remplissage, collecte des cellules saisies et validation.
import { resolveCanonicalNoteType } from "../../evaluation-forms";

// Pré-remplit la grille à partir des notes existantes.
//  - mode normal      : clé = eleveId (une période figée).
//  - multipériode     : clé = `${eleveId}|${periode}` (toutes les périodes,
//                       pour saisir les 2-3 compositions d'un coup).
export function construireGrille({ classe, type, periode, matiere = "", periodes = [], multiPeriode = false, eleves, mesNotes, schoolInfo, utilisateur }) {
  const section = utilisateur.section || "secondaire";
  const map = {};
  const find = (eleveId, per) => mesNotes.find(
    (n) => n.eleveId === eleveId && n.periode === per
      && resolveCanonicalNoteType(n.type, schoolInfo, section) === type
      // Au primaire (multi-matières), on cible la matière sélectionnée.
      && (!matiere || n.matiere === matiere),
  );
  eleves
    .filter((e) => e.classe === classe)
    .forEach((e) => {
      if (multiPeriode) {
        periodes.forEach((per) => {
          const ex = find(e._id, per);
          map[`${e._id}|${per}`] = ex ? String(ex.note ?? "") : "";
        });
      } else {
        const ex = find(e._id, periode);
        map[e._id] = ex ? String(ex.note ?? "") : "";
      }
    });
  return map;
}

// Construit la liste des notes à sauvegarder (cellules non vides), avec le
// type canonique, la période de chaque cellule et l'éventuel noteId existant.
// eleveId (id Firestore) et periode ne contiennent jamais « | ».
export function collectGridNotes({ gridForm, mesNotes, schoolInfo, utilisateur }) {
  const section = utilisateur.section || "secondaire";
  const canonical = resolveCanonicalNoteType(gridForm.type, schoolInfo, section);
  const matiere = gridForm.matiere || "";
  const aSauver = Object.entries(gridForm.notes)
    .filter(([, val]) => val !== "" && val != null)
    .map(([key, val]) => {
      let eleveId = key;
      let periode = gridForm.periode;
      if (gridForm.multiPeriode) {
        const idx = key.lastIndexOf("|");
        eleveId = key.slice(0, idx);
        periode = key.slice(idx + 1);
      }
      const existante = mesNotes.find(
        (n) => n.eleveId === eleveId && n.periode === periode
          && resolveCanonicalNoteType(n.type, schoolInfo, section) === canonical
          && (!matiere || n.matiere === matiere),
      );
      return { eleveId, periode, matiere, note: Number(val), noteId: existante?._id || "" };
    });
  return { canonical, aSauver };
}

// Valide une liste de notes. Renvoie un message d'erreur ou null si valide.
// maxNote : 20 au secondaire, 10 au primaire.
export function validateGridNotes(aSauver, maxNote = 20) {
  if (aSauver.length === 0) return "Saisis au moins une note avant d'enregistrer.";
  const invalide = aSauver.find((n) => !Number.isFinite(n.note) || n.note < 0 || n.note > maxNote);
  if (invalide) return `Note invalide détectée (doit être un nombre entre 0 et ${maxNote}).`;
  return null;
}
