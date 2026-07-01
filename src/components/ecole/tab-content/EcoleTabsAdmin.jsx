import { LivretsTab } from "../../LivretsTab";
import { EmploiDuTempsTab } from "../EmploiDuTempsTab";
import { AttestationsTab } from "../AttestationsTab";
import { EnseignementsTab } from "../EnseignementsTab";
import { DisciplineTab } from "../DisciplineTab";
import { BulletinsTab } from "../BulletinsTab";
import { MatieresTab } from "../MatieresTab";

// Onglets de gestion : enseignements, discipline, bulletins, livrets,
// matières, emploi du temps, attestations.
export function EcoleTabsAdmin({ e, avecEns, userRole, annee, maxNote, matieresPredefinies, cleNotes, cleEleves }) {
  return (
    <>
      {/* ── ENSEIGNEMENTS ── */}
      {e.tab === "enseignements" && <EnseignementsTab
        enseignements={e.enseignements}
        cEng={e.cEng}
        ajEng={e.ajEng}
        modEng={e.modEng}
        supEng={e.supEng}
        classes={e.classes}
        ens={e.ens}
        matieres={e.matieres}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
      />}

      {/* ── DISCIPLINE ── */}
      {e.tab === "discipline" && <DisciplineTab
        absences={e.absences}
        cAbs={e.cAbs}
        ajAbs={e.ajAbs}
        supAbs={e.supAbs}
        eleves={e.eleves}
        avecEns={avecEns}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        envoyerPush={e.envoyerPush}
      />}

      {/* ── BULLETINS ── */}
      {e.tab === "bulletins" && <BulletinsTab
        periodes={e.periodes}
        rechercheMatricule={e.rechercheMatricule}
        setRechercheMatricule={e.setRechercheMatricule}
        periodeB={e.periodeB}
        setPeriodeB={e.setPeriodeB}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classesUniq={e.classesUniq}
        elevesFiltres={e.elevesFiltres}
        eleves={e.eleves}
        notes={e.notes}
        matieres={e.matieres}
        matieresForClasse={e.matieresForClasse}
        schoolInfo={e.schoolInfo}
        moisAnnee={e.moisAnnee}
        maxNote={maxNote}
        avecEns={avecEns}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        getAppreciation={e.getAppreciation}
        saveAppreciation={e.saveAppreciation}
        appreciationsParEleveB={e.appreciationsParEleveB}
        toast={e.toast}
      />}

      {/* ── LIVRETS ── */}
      {e.tab === "livrets" && <LivretsTab
        periodes={e.periodes}
        cleEleves={cleEleves} cleNotes={cleNotes}
        matieres={e.matieres} maxNote={maxNote}
        userRole={userRole} annee={annee}
      />}

      {/* ── MATIÈRES ── */}
      {e.tab === "matieres" && <MatieresTab
        matieres={e.matieres}
        cMat={e.cMat}
        ajMat={e.ajMat}
        modMat={e.modMat}
        supMat={e.supMat}
        classes={e.classes}
        matieresPredefinies={matieresPredefinies}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
      />}

      {e.tab === "emploidutemps" && avecEns && <EmploiDuTempsTab
        maxNote={maxNote}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        isPrimarySection={e.isPrimarySection}
        form={e.form}
        setForm={e.setForm}
        chg={e.chg}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classes={e.classes}
        matieres={e.matieres}
        ens={e.ens}
        emplois={e.emplois}
        cEmp={e.cEmp}
        ajEmp={e.ajEmp}
        modEmp={e.modEmp}
        supEmp={e.supEmp}
      />}

      {/* ── ATTESTATIONS DE NIVEAU ── */}
      {e.tab === "attestations" && <AttestationsTab
        rechercheMatricule={e.rechercheMatricule}
        setRechercheMatricule={e.setRechercheMatricule}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classesUniq={e.classesUniq}
        elevesFiltres={e.elevesFiltres}
        schoolInfo={e.schoolInfo}
        annee={annee}
        avecEns={avecEns}
        cE={e.cE}
      />}
    </>
  );
}
