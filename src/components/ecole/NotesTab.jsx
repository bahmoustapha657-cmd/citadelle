import { useTranslation } from "react-i18next";
import { NotesToolbar } from "./notes-tab/NotesToolbar";
import { NotesGrille } from "./notes-tab/NotesGrille";
import { NotesListe } from "./notes-tab/NotesListe";
import { ImportNotesModal } from "./notes-tab/ImportNotesModal";
import { AjoutNoteModal } from "./notes-tab/AjoutNoteModal";

// Onglet Notes : barre d'outils + vue (liste/grille) + modales import/saisie.
// Les blocs sont dans notes-tab/.
export function NotesTab({
  annee,
  periodes = ["T1", "T2", "T3"],
  notes,
  cN,
  ajN,
  supN,
  eleves,
  matieres,
  matieresForClasse,
  noteForms,
  defaultNoteType,
  schoolInfo,
  isPrimarySection,
  avecEns,
  maxNote,
  readOnly,
  canCreate,
  canEdit,
  form,
  setForm,
  modal,
  setModal,
  notesVue,
  setNotesVue,
  grilleClasse,
  setGrilleClasse,
  grillePeriode,
  setGrillePeriode,
  grilleType,
  setGrilleType,
  grilleChanges,
  setGrilleChanges,
  grilleSaving,
  setGrilleSaving,
  grilleMode,
  setGrilleMode,
  grilleMatiere,
  setGrilleMatiere,
  grilleEleve,
  setGrilleEleve,
  importPreview,
  setImportPreview,
  importEnCours,
  setImportEnCours,
  toast,
}) {
  const { t } = useTranslation();

  return (
    <div>
      <NotesToolbar
        t={t} notes={notes} notesVue={notesVue} setNotesVue={setNotesVue}
        avecEns={avecEns} maxNote={maxNote} schoolInfo={schoolInfo} isPrimarySection={isPrimarySection}
        eleves={eleves} matieres={matieres} noteForms={noteForms} periodes={periodes}
        canCreate={canCreate} setForm={setForm} setModal={setModal} defaultNoteType={defaultNoteType}
      />

      {notesVue === "grille" && (
        <NotesGrille
          eleves={eleves}
          notes={notes}
          matieresForClasse={matieresForClasse}
          noteForms={noteForms}
          periodes={periodes}
          maxNote={maxNote}
          annee={annee}
          canCreate={canCreate}
          ajN={ajN}
          toast={toast}
          grilleClasse={grilleClasse} setGrilleClasse={setGrilleClasse}
          grillePeriode={grillePeriode} setGrillePeriode={setGrillePeriode}
          grilleType={grilleType} setGrilleType={setGrilleType}
          grilleChanges={grilleChanges} setGrilleChanges={setGrilleChanges}
          grilleSaving={grilleSaving} setGrilleSaving={setGrilleSaving}
          grilleMode={grilleMode} setGrilleMode={setGrilleMode}
          grilleMatiere={grilleMatiere} setGrilleMatiere={setGrilleMatiere}
          grilleEleve={grilleEleve} setGrilleEleve={setGrilleEleve}
        />
      )}

      {notesVue === "liste" && (
        <NotesListe
          cN={cN}
          notes={notes}
          maxNote={maxNote}
          readOnly={readOnly}
          schoolInfo={schoolInfo}
          isPrimarySection={isPrimarySection}
          canEdit={canEdit}
          supN={supN}
        />
      )}

      {modal === "import_notes" && canCreate && (
        <ImportNotesModal
          setModal={setModal}
          importPreview={importPreview} setImportPreview={setImportPreview}
          importEnCours={importEnCours} setImportEnCours={setImportEnCours}
          noteForms={noteForms}
          schoolInfo={schoolInfo}
          isPrimarySection={isPrimarySection}
          periodes={periodes}
          maxNote={maxNote}
          eleves={eleves}
          ajN={ajN}
          annee={annee}
          toast={toast}
        />
      )}

      {modal === "add_n" && canCreate && (
        <AjoutNoteModal
          form={form} setForm={setForm} setModal={setModal}
          eleves={eleves}
          matieresForClasse={matieresForClasse}
          noteForms={noteForms}
          defaultNoteType={defaultNoteType}
          maxNote={maxNote}
          schoolInfo={schoolInfo}
          isPrimarySection={isPrimarySection}
          periodes={periodes}
          annee={annee}
          ajN={ajN}
          toast={toast}
        />
      )}
    </div>
  );
}
