import { TransfertsPanel } from "../../TransfertsPanel";
import { EnrolmentTab } from "../EnrolmentTab";
import { FondationTab } from "../FondationTab";
import { PersonnelTab } from "../PersonnelTab";
import { MensualitesTab } from "../MensualitesTab";
import { EnseignantsTab } from "../EnseignantsTab";

// Onglets personnel & scolarité : enseignants, personnel, fondation,
// enrôlement, mensualités, transferts.
export function ComptaTabsScolarite({ c, readOnly, annee, userRole }) {
  return (
    <>
      {/* ══ ONGLET PERSONNEL ENSEIGNANT (vue hybride) ══ */}
      {c.tab === "enseignants" && <EnseignantsTab
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        toast={c.toast}
        logAction={c.logAction}
        ensPrimaire={c.ensPrimaire}
        ensCollege={c.ensCollege}
        ensLycee={c.ensLycee}
        ajEnsPrim={c.ajEnsPrim}
        ajEnsCol={c.ajEnsCol}
        ajEnsLyc={c.ajEnsLyc}
        modEnsPrim={c.modEnsPrim}
        modEnsCol={c.modEnsCol}
        modEnsLyc={c.modEnsLyc}
        supEnsPrim={c.supEnsPrim}
        supEnsCol={c.supEnsCol}
        supEnsLyc={c.supEnsLyc}
      />}

      {/* ══ ONGLET PERSONNEL ══ */}
      {c.tab === "personnel" && <PersonnelTab
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        personnel={c.personnel}
        cPers={c.cPers}
        supPers={c.supPers}
        savePersonnel={c.savePersonnel}
      />}

      {c.tab === "fondation" && <FondationTab
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        versements={c.versements}
        cV={c.cV}
        ajV={c.ajV}
        modV={c.modV}
        supV={c.supV}
        enreg={c.enreg}
      />}

      {c.tab === "enrolment" && <EnrolmentTab
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        readOnly={readOnly}
        elevesC={c.elevesC}
        elevesL={c.elevesL}
        elevesP={c.elevesP}
        cEC={c.cEC}
        cEL={c.cEL}
        cEP={c.cEP}
        tousElevesScolarite={c.tousElevesScolarite}
        ajoutParNiveau={c.ajoutParNiveau}
        suppressionParNiveau={c.suppressionParNiveau}
        modifParNiveau={c.modifParNiveau}
        ensureClasse={c.ensureClasse}
        sortAlpha={c.sortAlpha}
      />}

      {c.tab === "mens" && <MensualitesTab
        tarifsClasses={c.tarifsClasses}
        saveTarif={c.saveTarif}
        getTarifBase={c.getTarifBase}
        getTarifRevision={c.getTarifRevision}
        getTarifAutre={c.getTarifAutre}
        getTarifIns={c.getTarifIns}
        getTarifReinsc={c.getTarifReinsc}
        canEditEleves={c.canEditEleves}
        eleves={c.eleves}
        elevesFiltres={c.elevesFiltres}
        classesU={c.classesU}
        niveau={c.niveau}
        setNiveau={c.setNiveau}
        filtClasse={c.filtClasse}
        setFiltClasse={c.setFiltClasse}
        moisAnnee={c.moisAnnee}
        annee={annee}
        readOnly={readOnly}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        schoolInfo={c.schoolInfo}
        toggleMens={c.toggleMens}
        toggleFraisAnnexe={c.toggleFraisAnnexe}
        getTarifInscriptionEleve={c.getTarifInscriptionEleve}
        getTarif={c.getTarif}
      />}

      {c.tab === "transferts" && <TransfertsPanel userRole={userRole} annee={annee} setTab={c.setTab} />}
    </>
  );
}
