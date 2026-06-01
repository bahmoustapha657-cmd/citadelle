import { RecettesTab } from "../RecettesTab";
import { DepensesTab } from "../DepensesTab";
import { BilanTab } from "../BilanTab";
import { SalairesTab } from "../SalairesTab";

// Onglets financiers : bilan, recettes, dépenses, états de salaires.
export function ComptaTabsFinancier({ c, readOnly, annee }) {
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
    </>
  );
}
