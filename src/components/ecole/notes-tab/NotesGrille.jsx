import { useNotesGrille } from "./use-notes-grille";
import { NotesGrilleToolbar } from "./NotesGrilleToolbar";
import { NotesGrilleTable } from "./NotesGrilleTable";

// Vue grille de saisie des notes : une matière par colonne, un élève par
// ligne, édition inline avec lot de modifications enregistré en bloc.
export function NotesGrille({
  eleves, notes, matieresForClasse, noteForms, periodes, maxNote, annee, canCreate, ajN, toast,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  grilleChanges, setGrilleChanges, grilleSaving, setGrilleSaving,
}) {
  const { classesUniqN, elevesGrille, matieresCols, valeurCellule, sauvegarderGrille } = useNotesGrille({
    eleves, notes, matieresForClasse, annee, ajN, toast, maxNote,
    grilleClasse, grillePeriode, grilleType, grilleChanges, setGrilleChanges, setGrilleSaving,
  });

  return (
    <div>
      <NotesGrilleToolbar
        classesUniqN={classesUniqN} periodes={periodes} noteForms={noteForms}
        grilleClasse={grilleClasse} setGrilleClasse={setGrilleClasse}
        grillePeriode={grillePeriode} setGrillePeriode={setGrillePeriode}
        grilleType={grilleType} setGrilleType={setGrilleType}
        grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
        grilleSaving={grilleSaving} sauvegarderGrille={sauvegarderGrille}
      />
      <NotesGrilleTable
        elevesGrille={elevesGrille} matieresCols={matieresCols} maxNote={maxNote} canCreate={canCreate}
        valeurCellule={valeurCellule} grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
      />
    </div>
  );
}
