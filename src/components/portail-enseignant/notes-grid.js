// Helpers purs de la grille de saisie des notes (portail enseignant) :
// pré-remplissage, collecte des cellules saisies et validation.
import { resolveCanonicalNoteType } from "../../evaluation-forms";

// Pré-remplit la grille à partir des notes existantes.
//  - mode normal      : clé = eleveId (une période figée).
//  - multipériode     : clé = `${eleveId}|${periode}` (toutes les périodes,
//                       pour saisir les 2-3 compositions d'un coup).
export function construireGrille({ classe, type, periode, matiere = "", periodes = [], matieres = [], multiPeriode = false, multiMatiere = false, eleves, mesNotes, schoolInfo, utilisateur }) {
  const section = utilisateur.section || "secondaire";
  const map = {};
  const find = (eleveId, per, mat) => mesNotes.find(
    (n) => n.eleveId === eleveId && n.periode === per
      && resolveCanonicalNoteType(n.type, schoolInfo, section) === type
      // On cible la matière de la cellule (sélecteur, ou colonne au multi-matières).
      && (!mat || n.matiere === mat),
  );
  eleves
    .filter((e) => e.classe === classe)
    .forEach((e) => {
      if (multiPeriode && multiMatiere) {
        // Grille complète : une colonne par couple (période, matière). Clé
        // `${eleveId}|${periode}|${matiere}`. On saisit tout puis 1 seul save.
        periodes.forEach((per) => {
          matieres.forEach((mat) => {
            const ex = find(e._id, per, mat);
            map[`${e._id}|${per}|${mat}`] = ex ? String(ex.note ?? "") : "";
          });
        });
      } else if (multiPeriode) {
        periodes.forEach((per) => {
          const ex = find(e._id, per, matiere);
          map[`${e._id}|${per}`] = ex ? String(ex.note ?? "") : "";
        });
      } else if (multiMatiere) {
        // Une colonne par matière de la classe (titulaire du primaire) : on
        // saisit toutes les matières d'un coup, période figée.
        matieres.forEach((mat) => {
          const ex = find(e._id, periode, mat);
          map[`${e._id}|${mat}`] = ex ? String(ex.note ?? "") : "";
        });
      } else {
        const ex = find(e._id, periode, matiere);
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
  const matiereFixe = gridForm.matiere || "";
  const aSauver = Object.entries(gridForm.notes)
    .filter(([, val]) => val !== "" && val != null)
    .map(([key, val]) => {
      let eleveId = key;
      let periode = gridForm.periode;
      let matiere = matiereFixe;
      if (gridForm.multiPeriode && gridForm.multiMatiere) {
        // Clé = `${eleveId}|${periode}|${matiere}`. eleveId et periode ne
        // contiennent jamais « | » : on coupe aux deux premiers séparateurs.
        const first = key.indexOf("|");
        const rest = key.slice(first + 1);
        const second = rest.indexOf("|");
        eleveId = key.slice(0, first);
        periode = rest.slice(0, second);
        matiere = rest.slice(second + 1);
      } else if (gridForm.multiPeriode) {
        const idx = key.lastIndexOf("|");
        eleveId = key.slice(0, idx);
        periode = key.slice(idx + 1);
      } else if (gridForm.multiMatiere) {
        // Clé = `${eleveId}|${matiere}` ; eleveId (id Firestore) ne contient
        // jamais « | », on coupe donc au premier séparateur.
        const idx = key.indexOf("|");
        eleveId = key.slice(0, idx);
        matiere = key.slice(idx + 1);
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
