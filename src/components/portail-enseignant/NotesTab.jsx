import { NotesListe } from "./notes-tab/NotesListe";
import { GrilleModale } from "./notes-tab/GrilleModale";
import { NoteModale } from "./notes-tab/NoteModale";

// Onglet "Notes" du Portail Enseignant : liste des notes de la période et deux
// modales d'édition (unitaire + grille de saisie en masse). Aiguille l'état et
// les actions du parent vers chaque vue.
export function NotesTab({
  c1,
  matiere,
  schoolInfo,
  utilisateur,
  periodeN, setPeriodeN, periodes,
  mesClasses,
  notesPeriode,
  noteForms,
  defaultNoteType,
  isPrimaire,
  matieresDispo,
  eleves,
  portalData,
  modalNote, setModalNote,
  formNote, setFormNote,
  gridForm, setGridForm,
  gridProgress,
  enregistrement,
  pendingSync, syncing, synchroniser,
  ouvrirCreationNote,
  ouvrirGrille,
  ouvrirEditionNote,
  supprimerNote,
  enregistrerNote,
  enregistrerGrille,
  majGrid,
}) {
  return (
    <>
      <NotesListe
        c1={c1} matiere={matiere} schoolInfo={schoolInfo} utilisateur={utilisateur}
        periodeN={periodeN} setPeriodeN={setPeriodeN} periodes={periodes} mesClasses={mesClasses}
        notesPeriode={notesPeriode} enregistrement={enregistrement}
        pendingSync={pendingSync} syncing={syncing} synchroniser={synchroniser}
        ouvrirGrille={ouvrirGrille} ouvrirCreationNote={ouvrirCreationNote}
        ouvrirEditionNote={ouvrirEditionNote} supprimerNote={supprimerNote}
      />

      {modalNote === "grid" && (
        <GrilleModale
          matiere={matiere} mesClasses={mesClasses} noteForms={noteForms} periodes={periodes}
          isPrimaire={isPrimaire} matieresDispo={matieresDispo}
          gridForm={gridForm} setGridForm={setGridForm} majGrid={majGrid} portalData={portalData}
          gridProgress={gridProgress} enregistrement={enregistrement}
          setModalNote={setModalNote} enregistrerGrille={enregistrerGrille}
        />
      )}

      {modalNote && modalNote !== "grid" && (
        <NoteModale
          modalNote={modalNote} setModalNote={setModalNote} formNote={formNote} setFormNote={setFormNote}
          eleves={eleves} noteForms={noteForms} defaultNoteType={defaultNoteType}
          periodeN={periodeN} periodes={periodes}
          enregistrement={enregistrement} enregistrerNote={enregistrerNote}
        />
      )}
    </>
  );
}
