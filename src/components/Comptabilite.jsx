import { useTranslation } from "react-i18next";
import { C } from "../constants";
import { Badge, Tabs, LectureSeule } from "./ui";
import { TransfertsPanel } from "./TransfertsPanel";
import { EnrolmentTab } from "./comptabilite/EnrolmentTab";
import { RecettesTab } from "./comptabilite/RecettesTab";
import { DepensesTab } from "./comptabilite/DepensesTab";
import { FondationTab } from "./comptabilite/FondationTab";
import { PersonnelTab } from "./comptabilite/PersonnelTab";
import { BilanTab } from "./comptabilite/BilanTab";
import { MensualitesTab } from "./comptabilite/MensualitesTab";
import { EnseignantsTab } from "./comptabilite/EnseignantsTab";
import { SalairesTab } from "./comptabilite/SalairesTab";
import { useComptabilite } from "./comptabilite/use-comptabilite";

// Orchestrateur du module Comptabilité : la logique vit dans
// useComptabilite, chaque onglet dans comptabilite/*Tab.jsx.
function Comptabilite({ readOnly, annee, userRole, verrouOuvert = false }) {
  const { t } = useTranslation();
  const c = useComptabilite({ readOnly, annee, userRole, verrouOuvert });
  const sd = c.salairesDomaine;

  const tabs = [
    { id: "bilan", label: t("accounting.tabs.bilan") },
    { id: "recettes", label: `${t("accounting.tabs.revenues")} (${c.recettes.length})` },
    { id: "depenses", label: `${t("accounting.tabs.expenses")} (${c.depenses.length})` },
    { id: "salaires", label: t("accounting.tabs.salaries") },
    { id: "enseignants", label: `${t("accounting.tabs.teachers")} (${c.ensPrimaire.length + c.ensCollege.length + c.ensLycee.length})` },
    { id: "personnel", label: `${t("accounting.tabs.staff")} (${c.personnel.length})` },
    { id: "fondation", label: `${t("accounting.tabs.donations")} (${c.versements.length})` },
    { id: "enrolment", label: `${t("accounting.tabs.students")} (${c.elevesC.length + c.elevesL.length + c.elevesP.length})` },
    { id: "mens", label: t("accounting.tabs.monthlyFees") },
    { id: "transferts", label: `🔄 ${t("accounting.tabs.transfers")}` },
  ];

  return (
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {c.schoolInfo?.logo && <img src={c.schoolInfo.logo} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.blueDark }}>{t("accounting.title")}</h2>
          <p style={{ margin: 0, fontSize: 12, color: C.green, fontWeight: 600 }}>{t("accounting.subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t("common.yearViewed")} :</label>
          <select value={c.anneeConsultee} onChange={(e) => c.setAnneeConsultee(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${c.enModeArchive ? "#f59e0b" : "#cbd5e1"}`, fontSize: 13, fontWeight: 700,
              background: c.enModeArchive ? "#fef3c7" : "#fff", color: c.enModeArchive ? "#92400e" : C.blueDark, cursor: "pointer" }}>
            {c.anneesDispo.map((a) => <option key={a} value={a}>{a}{a === c.anneeCourante ? ` (${t("common.current")})` : ""}</option>)}
          </select>
          {c.enModeArchive && <Badge color="orange">📚 {t("common.archive")} — {t("common.readOnly")}</Badge>}
        </div>
      </div>
      {readOnly && <LectureSeule />}
      <Tabs items={tabs} actif={c.tab} onChange={c.setTab} />

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
    </div>
  );
}

export { Comptabilite };
