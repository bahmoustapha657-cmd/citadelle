import { useNotesGrille } from "./use-notes-grille";
import { NotesGrilleToolbar } from "./NotesGrilleToolbar";
import { NotesGrilleTable } from "./NotesGrilleTable";

// Vue grille de saisie des notes, 3 modes (un axe figé) :
//   "periode" : lignes élèves, colonnes matières (période figée)
//   "matiere" : lignes élèves, colonnes périodes (matière figée)
//   "eleve"   : lignes matières, colonnes périodes (élève figé = bulletin)
export function NotesGrille({
  eleves, notes, matieresForClasse, noteForms, periodes, maxNote, annee, canCreate, ajN, toast,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  grilleMode, setGrilleMode, grilleMatiere, setGrilleMatiere, grilleEleve, setGrilleEleve,
  grilleChanges, setGrilleChanges, grilleSaving, setGrilleSaving,
}) {
  const { classesUniqN, elevesGrille, matieresClasse, lignes, colonnes, valeurCellule, cleCellule, sauvegarderGrille } = useNotesGrille({
    eleves, notes, matieresForClasse, annee, ajN, toast, maxNote,
    grilleClasse, grillePeriode, grilleType, periodes,
    grilleMode, grilleMatiere, grilleEleve,
    grilleChanges, setGrilleChanges, setGrilleSaving,
  });

  return (
    <div>
      <NotesGrilleToolbar
        classesUniqN={classesUniqN} periodes={periodes} noteForms={noteForms}
        matieresClasse={matieresClasse} elevesGrille={elevesGrille}
        grilleClasse={grilleClasse} setGrilleClasse={setGrilleClasse}
        grillePeriode={grillePeriode} setGrillePeriode={setGrillePeriode}
        grilleType={grilleType} setGrilleType={setGrilleType}
        grilleMode={grilleMode} setGrilleMode={setGrilleMode}
        grilleMatiere={grilleMatiere} setGrilleMatiere={setGrilleMatiere}
        grilleEleve={grilleEleve} setGrilleEleve={setGrilleEleve}
        grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
        grilleSaving={grilleSaving} sauvegarderGrille={sauvegarderGrille}
      />
      <NotesGrilleTable
        lignes={lignes} colonnes={colonnes} ligneHeader={grilleMode === "eleve" ? "Matière" : "Élève"}
        maxNote={maxNote} canCreate={canCreate}
        valeurCellule={valeurCellule} cleCellule={cleCellule} grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
      />
    </div>
  );
}
