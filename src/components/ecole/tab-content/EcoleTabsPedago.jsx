import { ApercuTab } from "../ApercuTab";
import { ClassesTab } from "../ClassesTab";
import { ElevesTab } from "../ElevesTab";
import { EnsTab } from "../EnsTab";
import { NotesTab } from "../NotesTab";

// Onglets pédagogiques : aperçu, classes, élèves, enseignants, notes.
export function EcoleTabsPedago({ e, avecEns, annee, classesPredefinies, maxNote, readOnly, cleEns, cleEleves, couleur }) {
  return (
    <>
      {/* ── APERÇU ── */}
      {e.tab === "apercu" && <ApercuTab
        classes={e.classes}
        eleves={e.eleves}
        ens={e.ens}
        notes={e.notes}
        absences={e.absences}
        avecEns={avecEns}
        moy={e.moy}
        maxNote={maxNote}
        cC={e.cC}
        cE={e.cE}
        classesUniq={e.classesUniq}
        effectifReel={e.effectifReel}
        matieresForClasse={e.matieresForClasse}
        couleur={couleur}
        schoolInfo={e.schoolInfo}
      />}

      {/* ── CLASSES ── */}
      {e.tab === "classes" && <ClassesTab
        classes={e.classes}
        eleves={e.eleves}
        ens={e.ens}
        cC={e.cC}
        ajC={e.ajC}
        modC={e.modC}
        supC={e.supC}
        schoolInfo={e.schoolInfo}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        classesPredefinies={classesPredefinies}
        effectifReel={e.effectifReel}
        saveClasse={e.saveClasse}
        toast={e.toast}
      />}

      {/* ── ÉLÈVES (lecture seule — enrôlement dans Comptabilité) ── */}
      {e.tab === "eleves" && <ElevesTab
        eleves={e.eleves}
        elevesFiltres={e.elevesFiltres}
        cE={e.cE}
        cleEleves={cleEleves}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classesUniq={e.classesUniq}
        avecEns={avecEns}
        annee={annee}
        schoolInfo={e.schoolInfo}
        schoolId={e.schoolId}
        toast={e.toast}
        logAction={e.logAction}
        canEdit={e.canEdit}
        canCreateParent={e.canCreateParent}
        parentEleve={e.parentEleve}
        setParentEleve={e.setParentEleve}
        formP={e.formP}
        setFormP={e.setFormP}
      />}

      {/* ── ENSEIGNANTS ── */}
      {e.tab === "ens" && avecEns && <EnsTab
        ens={e.ens}
        cEns={e.cEns}
        supEns={e.supEns}
        cleEns={cleEns}
        isPrimarySection={e.isPrimarySection}
        couleur={couleur}
        schoolId={e.schoolId}
        toast={e.toast}
        logAction={e.logAction}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        ensCompte={e.ensCompte}
        setEnsCompte={e.setEnsCompte}
        formC={e.formC}
        setFormC={e.setFormC}
        saveEnseignant={e.saveEnseignant}
      />}

      {/* ── NOTES ── */}
      {e.tab === "notes" && <NotesTab
        annee={annee}
        periodes={e.periodes}
        notes={e.notes}
        cN={e.cN}
        ajN={e.ajN}
        supN={e.supN}
        eleves={e.eleves}
        matieres={e.matieres}
        matieresForClasse={e.matieresForClasse}
        noteForms={e.noteForms}
        defaultNoteType={e.defaultNoteType}
        schoolInfo={e.schoolInfo}
        isPrimarySection={e.isPrimarySection}
        avecEns={avecEns}
        maxNote={maxNote}
        readOnly={readOnly}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        notesVue={e.notesVue}
        setNotesVue={e.setNotesVue}
        grilleClasse={e.grilleClasse}
        setGrilleClasse={e.setGrilleClasse}
        grillePeriode={e.grillePeriode}
        setGrillePeriode={e.setGrillePeriode}
        grilleType={e.grilleType}
        setGrilleType={e.setGrilleType}
        grilleChanges={e.grilleChanges}
        setGrilleChanges={e.setGrilleChanges}
        grilleSaving={e.grilleSaving}
        setGrilleSaving={e.setGrilleSaving}
        grilleMultiPeriode={e.grilleMultiPeriode}
        setGrilleMultiPeriode={e.setGrilleMultiPeriode}
        grilleMatiere={e.grilleMatiere}
        setGrilleMatiere={e.setGrilleMatiere}
        importPreview={e.importPreview}
        setImportPreview={e.setImportPreview}
        importEnCours={e.importEnCours}
        setImportEnCours={e.setImportEnCours}
        toast={e.toast}
      />}
    </>
  );
}
