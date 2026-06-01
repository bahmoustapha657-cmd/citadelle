import { TransfertsPanel } from "../TransfertsPanel";
import { EnrolmentTab } from "./EnrolmentTab";
import { RecettesTab } from "./RecettesTab";
import { DepensesTab } from "./DepensesTab";
import { FondationTab } from "./FondationTab";
import { PersonnelTab } from "./PersonnelTab";
import { BilanTab } from "./BilanTab";
import { MensualitesTab } from "./MensualitesTab";
import { EnseignantsTab } from "./EnseignantsTab";
import { SalairesTab } from "./SalairesTab";

// Aiguillage du contenu selon l'onglet actif (c.tab). La logique vit dans
// useComptabilite (objet `c`, dont c.salairesDomaine alias `sd`).
export function ComptaTabContent({ c, readOnly, annee, userRole }) {
  const sd = c.salairesDomaine;
  return (
    <>
      {c.tab === "bilan" && <BilanTab
        schoolInfo={c.schoolInfo}
        periodes={c.periodes}
        canCreate={c.canCreate}
        toggleBlocage={c.toggleBlocage}
        recettes={c.recettes}
        depenses={c.depenses}
        cR={c.cR}
        cD={c.cD}
        totR={c.totR}
        totD={c.totD}
        totVers={c.totVers}
        totNetSec={c.totNetSec}
        totNetPrim={c.totNetPrim}
        totNetPers={c.totNetPers}
        impaye={c.impaye}
        pctImpaye={c.pctImpaye}
        salairesMois={c.salairesMois}
        moisLabel={c.moisLabel}
        mensualiteOverview={c.mensualiteOverview}
      />}

      {c.tab === "recettes" && <RecettesTab
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        recettes={c.recettes}
        cR={c.cR}
        ajR={c.ajR}
        modR={c.modR}
        supR={c.supR}
        enreg={c.enreg}
        periodes={c.periodes}
        defaultPeriode={c.defaultPeriode}
      />}

      {c.tab === "depenses" && <DepensesTab
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        depenses={c.depenses}
        cD={c.cD}
        ajD={c.ajD}
        modD={c.modD}
        supD={c.supD}
        enreg={c.enreg}
        periodes={c.periodes}
        defaultPeriode={c.defaultPeriode}
      />}

      {/* ── ÉTATS DE SALAIRES MODÈLE EXCEL ── */}
      {c.tab === "salaires" && <SalairesTab
        sousTabSal={c.sousTabSal}
        setSousTabSal={c.setSousTabSal}
        moisSel={c.moisSel}
        setMoisSel={c.setMoisSel}
        moisSalaire={c.moisSalaire}
        moisLabel={sd.moisLabel}
        moisModale={sd.moisModale}
        annee={annee}
        primeDefaut={c.primeDefaut}
        setPrimeDefaut={c.setPrimeDefaut}
        form={c.form}
        setForm={c.setForm}
        modal={c.modal}
        setModal={c.setModal}
        canCreate={c.canCreate}
        canEdit={c.canEdit}
        readOnly={readOnly}
        salaires={c.salaires}
        cS={c.cS}
        ajS={c.ajS}
        modS={c.modS}
        supS={c.supS}
        salairesMois={sd.salairesMois}
        salairesSec={sd.salairesSec}
        salairesPrim={sd.salairesPrim}
        salairesPers={sd.salairesPers}
        totNetSec={sd.totNetSec}
        totNetPrim={sd.totNetPrim}
        totNetPers={sd.totNetPers}
        bonsMois={sd.bonsMois}
        ajBon={c.ajBon}
        modBon={c.modBon}
        supBon={c.supBon}
        ensPrimaire={c.ensPrimaire}
        ensCollege={c.ensCollege}
        ensLycee={c.ensLycee}
        personnel={c.personnel}
        filtrePrimNom={c.filtrePrimNom}
        setFiltrePrimNom={c.setFiltrePrimNom}
        filtrePrimClasse={c.filtrePrimClasse}
        setFiltrePrimClasse={c.setFiltrePrimClasse}
        calcExecute={sd.calcExecute}
        calcMontant={sd.calcMontant}
        calcNet={sd.calcNet}
        calcNetF={sd.calcNetF}
        autoGenererSalaires={sd.autoGenererSalaires}
        appliquerBons={sd.appliquerBons}
        imprimerSalaires={sd.imprimerSalaires}
        enreg={c.enreg}
        saveSalaire={c.saveSalaire}
      />}

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
