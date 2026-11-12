import { LivretsTab } from "../../LivretsTab";
import { EmploiDuTempsTab } from "../EmploiDuTempsTab";
import { AttestationsTab } from "../AttestationsTab";
import { EnseignementsTab } from "../EnseignementsTab";
import { DisciplineTab } from "../DisciplineTab";
import { BulletinsTab } from "../BulletinsTab";
import { HonneurTab } from "../HonneurTab";
import { MatieresTab } from "../MatieresTab";

// Onglets de gestion : enseignements, discipline, bulletins, tableau
// d'honneur, livrets, matières, emploi du temps, attestations.
export function EcoleTabsAdmin({ e, section, avecEns, userRole, annee, maxNote, matieresPredefinies, cleNotes, cleEleves, readOnly = false }) {
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
        matieres={e.matieresToutes}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
      />}

      {/* ── DISCIPLINE ── */}
      {/* Le surveillant général gère pleinement les absences (saisie +
          correction) sans détenir le droit d'édition global du module. */}
      {e.tab === "discipline" && <DisciplineTab
        absences={e.absences}
        cAbs={e.cAbs}
        ajAbs={e.ajAbs}
        supAbs={e.supAbs}
        eleves={e.eleves}
        section={section}
        form={e.form}
        setForm={e.setForm}
        modal={e.modal}
        setModal={e.setModal}
        canCreate={e.canCreateDiscipline}
        canEdit={e.canEditDiscipline}
        envoyerPush={e.envoyerPush}
        // Registres d'appel : imprimés par les chefs de section (écriture sur
        // le module de la section) et la Direction — pas par le surveillant,
        // qui n'écrit que la discipline.
        peutImprimerRegistres={userRole === "direction" || !readOnly}
        ens={e.ens}
        classesEcole={e.classes}
        emplois={e.emplois}
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
        section={section}
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
        absences={e.absences}
        emplois={e.emplois}
      />}

      {/* ── TABLEAU D'HONNEUR (un par classe) ──
          `section` règle le calcul des moyennes, comme au bulletin, et
          nomme la section sur le palmarès « toute la section ». */}
      {e.tab === "honneur" && <HonneurTab
        classes={e.classes}
        eleves={e.eleves}
        notes={e.notes}
        matieres={e.matieres}
        periodes={e.periodes}
        section={section}
        maxNote={maxNote}
        schoolInfo={e.schoolInfo}
        anneeConsultee={e.anneeConsultee}
        chargement={e.cE || e.cN}
      />}

      {/* ── LIVRETS ── */}
      {e.tab === "livrets" && <LivretsTab
        section={section} periodes={e.periodes}
        cleEleves={cleEleves} cleNotes={cleNotes}
        matieres={e.matieres} maxNote={maxNote}
        userRole={userRole} annee={annee}
      />}

      {/* ── MATIÈRES ── */}
      {e.tab === "matieres" && <MatieresTab
        matieres={e.matieresToutes}
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
        section={section}
        canCreate={e.canCreate}
        canEdit={e.canEdit}
        isPrimarySection={e.isPrimarySection}
        form={e.form}
        setForm={e.setForm}
        chg={e.chg}
        filtreClasse={e.filtreClasse}
        setFiltreClasse={e.setFiltreClasse}
        classes={e.classes}
        matieres={e.matieresToutes}
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
        eleves={e.eleves}
        schoolInfo={e.schoolInfo}
        annee={e.anneeConsultee}
        section={section}
        cE={e.cE}
        notes={e.notes}
        matieresForClasse={e.matieresForClasse}
        periodes={e.periodes}
        maxNote={maxNote}
        cleNotes={cleNotes}
      />}
    </>
  );
}
