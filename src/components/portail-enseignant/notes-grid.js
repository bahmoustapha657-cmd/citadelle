// Helpers purs de la grille de saisie des notes (portail enseignant) :
// pré-remplissage, collecte des cellules saisies et validation.
import { resolveCanonicalNoteType } from "../../evaluation-forms";
import i18n from "../../i18n";
import { moisDeNote, noteAvecMois } from "../../note-utils";
import { estPeriodeMois } from "../../period-utils";
import { colonnesPeriodes, lireJetonPeriode, moisAEnregistrer } from "../../notes-mois";

// ── Mois des évaluations (oraux et écrits du secondaire, notes-mois.js) ─────
// Une forme qui porte un mois se saisit pour UN mois : période figée → le
// mois choisi au-dessus de la grille (gridForm.mois) ; toutes les périodes →
// une colonne par (période, mois), jeton « T1:Oct » dans la clé de cellule.
// Mois à comparer pour une cellule : "" = pas de filtre (forme sans mois, ou
// période au mois en périodicité mensuelle) ; « ? » quand le mois manque
// (aucune note ne correspond, la validation bloque l'enregistrement).
const moisCible = (avecMois, periode, mois) => (avecMois && !estPeriodeMois(periode) ? mois || "?" : "");
const dansLeMois = (note, cible, moisAnnee) => !cible || moisDeNote(note, moisAnnee) === cible;

// Pré-remplit la grille à partir des notes existantes.
//  - mode normal      : clé = eleveId (une période figée).
//  - multipériode     : clé = `${eleveId}|${periode}` (toutes les périodes,
//                       pour saisir les 2-3 compositions d'un coup) ;
//                       `${eleveId}|${periode}:${mois}` pour une forme à mois.
export function construireGrille({ classe, type, periode, matiere = "", mois = "", periodes = [], matieres = [], moisAnnee = [], multiPeriode = false, multiMatiere = false, eleves, mesNotes, schoolInfo, utilisateur }) {
  const section = utilisateur.section || "secondaire";
  const avecMois = noteAvecMois(type, section);
  const colonnes = colonnesPeriodes(periodes, { avecMois, moisAnnee });
  const map = {};
  const find = (eleveId, per, mat, moisCol = mois) => mesNotes.find(
    (n) => n.eleveId === eleveId && n.periode === per
      && resolveCanonicalNoteType(n.type, schoolInfo, section) === type
      // On cible la matière de la cellule (sélecteur, ou colonne au multi-matières).
      && (!mat || n.matiere === mat)
      && dansLeMois(n, moisCible(avecMois, per, moisCol), moisAnnee),
  );
  eleves
    .filter((e) => e.classe === classe)
    .forEach((e) => {
      if (multiPeriode && multiMatiere) {
        // Grille complète : une colonne par couple (période, matière). Clé
        // `${eleveId}|${periode}|${matiere}`. On saisit tout puis 1 seul save.
        colonnes.forEach((col) => {
          matieres.forEach((mat) => {
            const ex = find(e._id, col.periode, mat, col.mois);
            map[`${e._id}|${col.jeton}|${mat}`] = ex ? String(ex.note ?? "") : "";
          });
        });
      } else if (multiPeriode) {
        colonnes.forEach((col) => {
          const ex = find(e._id, col.periode, matiere, col.mois);
          map[`${e._id}|${col.jeton}`] = ex ? String(ex.note ?? "") : "";
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

// Une cellule doit-elle être enregistrée ? Non vide ET différente de sa valeur
// INITIALE (le prérempli serveur) : la grille précharge les notes existantes,
// on ne réécrit pas celles que l'enseignant n'a pas touchées (écritures — et
// lectures de validation côté serveur — en moins ; crucial sous quota).
// `init` absent/vide = cellule nouvellement saisie → à enregistrer.
export function celluleASauver(val, init) {
  if (val === "" || val == null) return false;
  if (init === "" || init == null) return true;
  return Number(val) !== Number(init);
}

// Construit la liste des notes à sauvegarder (cellules non vides ET nouvelles
// ou modifiées par rapport à gridForm.initiales — sans `initiales`, toutes les
// cellules non vides, comme avant), avec le type canonique, la période de
// chaque cellule et l'éventuel noteId existant.
// eleveId (id Firestore) et periode ne contiennent jamais « | ».
// Chaque note porte son mois (moisAEnregistrer) ; `moisManquant` signale une
// forme à mois saisie sans mois choisi (refusée par validateGridNotes).
export function collectGridNotes({ gridForm, mesNotes, schoolInfo, utilisateur, moisAnnee = [] }) {
  const section = utilisateur.section || "secondaire";
  const canonical = resolveCanonicalNoteType(gridForm.type, schoolInfo, section);
  const avecMois = noteAvecMois(canonical, section);
  const matiereFixe = gridForm.matiere || "";
  const initiales = gridForm.initiales || null;
  const aSauver = Object.entries(gridForm.notes)
    .filter(([key, val]) => (initiales ? celluleASauver(val, initiales[key]) : val !== "" && val != null))
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
      // Colonnes de périodes : « T1:Oct » → période T1, mois Oct.
      const jeton = lireJetonPeriode(periode);
      periode = jeton.periode;
      const moisCol = gridForm.multiPeriode ? jeton.mois : (gridForm.mois || "");
      const cible = moisCible(avecMois, periode, moisCol);
      const existante = mesNotes.find(
        (n) => n.eleveId === eleveId && n.periode === periode
          && resolveCanonicalNoteType(n.type, schoolInfo, section) === canonical
          && (!matiere || n.matiere === matiere)
          && dansLeMois(n, cible, moisAnnee),
      );
      return {
        eleveId, periode, matiere, note: Number(val), noteId: existante?._id || "",
        mois: moisAEnregistrer({ type: canonical, section, periode, mois: moisCol }),
        moisManquant: cible === "?",
      };
    });
  return { canonical, aSauver };
}

// Valide une liste de notes. Renvoie un message d'erreur ou null si valide.
// maxNote : 20 au secondaire, 10 au primaire.
export function validateGridNotes(aSauver, maxNote = 20) {
  if (aSauver.length === 0) return i18n.t("teacher.notes.nothingNew");
  if (aSauver.some((n) => n.moisManquant)) return i18n.t("gradeMonth.required");
  const invalide = aSauver.find((n) => !Number.isFinite(n.note) || n.note < 0 || n.note > maxNote);
  if (invalide) return i18n.t("teacher.notes.invalid", { max: maxNote });
  return null;
}
