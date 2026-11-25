import { useState } from "react";
import { useNotesGrille } from "./use-notes-grille";
import { NotesGrilleToolbar } from "./NotesGrilleToolbar";
import { NotesGrilleTable } from "./NotesGrilleTable";
import { champMois, moisAJour } from "../../../notes-mois";

// Vue grille de saisie des notes, 3 modes (un axe figé) :
//   "periode" : lignes élèves, colonnes matières (période figée)
//   "matiere" : lignes élèves, colonnes périodes (matière figée)
//   "eleve"   : lignes matières, colonnes périodes (élève figé = bulletin)
// Oraux et écrits du secondaire : en mode « periode », un mois de la période
// à choisir (le mois en cours d'office) ; ailleurs, une colonne par mois.
export function NotesGrille({
  eleves, notes, matieresForClasse, noteForms, periodes, moisAnnee = [], section = "", maxNote, annee, canCreate, ajN, toast,
  grilleClasse, setGrilleClasse, grillePeriode, setGrillePeriode, grilleType, setGrilleType,
  grilleMode, setGrilleMode, grilleMatiere, setGrilleMatiere, grilleEleve, setGrilleEleve,
  grilleChanges, setGrilleChanges, grilleSaving, setGrilleSaving, triEleves,
}) {
  // Mois choisi dans la barre ; gardé tant qu'il appartient à la période.
  const [moisChoisi, setGrilleMois] = useState("");
  const { choix } = champMois({ type: grilleType, section, periode: grillePeriode, moisAnnee });
  const grilleMois = moisAJour(moisChoisi, choix);

  const {
    classesUniqN, elevesGrille, matieresClasse, lignes, colonnes, valeurCellule, cleCellule, libelleColonne,
    champMoisGrille, sauvegarderGrille,
  } = useNotesGrille({
    eleves, notes, matieresForClasse, annee, ajN, toast, maxNote,
    grilleClasse, grillePeriode, grilleType, periodes,
    grilleMode, grilleMatiere, grilleEleve,
    grilleMois, moisAnnee, section,
    grilleChanges, setGrilleChanges, setGrilleSaving, triEleves,
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
        champMoisGrille={champMoisGrille} grilleMois={grilleMois} setGrilleMois={setGrilleMois}
        grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
        grilleSaving={grilleSaving} sauvegarderGrille={sauvegarderGrille}
        triEleves={triEleves}
      />
      <NotesGrilleTable
        lignes={lignes} colonnes={colonnes} libelleColonne={libelleColonne} ligneHeader={grilleMode === "eleve" ? "Matière" : "Élève"}
        maxNote={maxNote} canCreate={canCreate}
        valeurCellule={valeurCellule} cleCellule={cleCellule} grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
      />
    </div>
  );
}
