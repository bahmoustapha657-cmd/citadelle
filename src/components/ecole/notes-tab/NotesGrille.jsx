import { useNotesGrille } from "./use-notes-grille";
import { NotesGrilleToolbar } from "./NotesGrilleToolbar";
import { NotesGrilleTable } from "./NotesGrilleTable";

// Vue grille de saisie des notes : un élève par ligne, édition inline avec
// lot de modifications enregistré en bloc. Colonnes = matières (mode normal)
// ou périodes (mode multipériode : saisir les 2-3 compositions d'un coup).
export function NotesGrille({
  eleves, notes, matieresForClasse, noteForms, periodes, maxNote, annee, canCreate, ajN, toast,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  grilleMultiPeriode, setGrilleMultiPeriode, grilleMatiere, setGrilleMatiere,
  grilleChanges, setGrilleChanges, grilleSaving, setGrilleSaving,
}) {
  const { classesUniqN, elevesGrille, matieresClasse, colonnes, valeurCellule, cleCellule, sauvegarderGrille } = useNotesGrille({
    eleves, notes, matieresForClasse, annee, ajN, toast, maxNote,
    grilleClasse, grillePeriode, grilleType, periodes,
    multiPeriode: grilleMultiPeriode, grilleMatiere,
    grilleChanges, setGrilleChanges, setGrilleSaving,
  });

  return (
    <div>
      <NotesGrilleToolbar
        classesUniqN={classesUniqN} periodes={periodes} noteForms={noteForms} matieresClasse={matieresClasse}
        grilleClasse={grilleClasse} setGrilleClasse={setGrilleClasse}
        grillePeriode={grillePeriode} setGrillePeriode={setGrillePeriode}
        grilleType={grilleType} setGrilleType={setGrilleType}
        multiPeriode={grilleMultiPeriode} setMultiPeriode={setGrilleMultiPeriode}
        grilleMatiere={grilleMatiere} setGrilleMatiere={setGrilleMatiere}
        grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
        grilleSaving={grilleSaving} sauvegarderGrille={sauvegarderGrille}
      />
      <NotesGrilleTable
        elevesGrille={elevesGrille} colonnes={colonnes} maxNote={maxNote} canCreate={canCreate}
        valeurCellule={valeurCellule} cleCellule={cleCellule} grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
      />
    </div>
  );
}
