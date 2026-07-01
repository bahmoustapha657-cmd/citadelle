import { useTranslation } from "react-i18next";
import { BulletinsToolbar } from "./bulletins-tab/BulletinsToolbar";
import { BulletinsTable } from "./bulletins-tab/BulletinsTable";
import { AppreciationModale } from "./bulletins-tab/AppreciationModale";
import { useBatchAppreciation } from "./bulletins-tab/use-batch-appreciation";

export function BulletinsTab({
  periodes = ["T1", "T2", "T3"],
  rechercheMatricule, setRechercheMatricule, periodeB, setPeriodeB,
  filtreClasse, setFiltreClasse, classesUniq, elevesFiltres, eleves, notes,
  matieres, matieresForClasse, schoolInfo, moisAnnee, maxNote, avecEns,
  form, setForm, modal, setModal, canCreate, canEdit,
  getAppreciation, saveAppreciation, appreciationsParEleveB, toast,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const elevesB = elevesFiltres.filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));

  const batchAppr = useBatchAppreciation({
    elevesB, notes, matieresForClasse, periodeB, getAppreciation, saveAppreciation, toast,
  });

  return (
    <div>
      <BulletinsToolbar
        t={t} rechercheMatricule={rechercheMatricule} setRechercheMatricule={setRechercheMatricule}
        periodeB={periodeB} setPeriodeB={setPeriodeB} periodes={periodes}
        filtreClasse={filtreClasse} setFiltreClasse={setFiltreClasse} classesUniq={classesUniq}
        elevesFiltres={elevesFiltres} schoolInfo={schoolInfo} moisAnnee={moisAnnee}
        notes={notes} matieres={matieres} maxNote={maxNote} avecEns={avecEns}
        matieresForClasse={matieresForClasse} appreciationsParEleveB={appreciationsParEleveB}
        batchAppr={batchAppr} canGenererLot={canCreate || canEdit}
      />

      <BulletinsTable
        t={t} elevesB={elevesB} notes={notes} matieresForClasse={matieresForClasse}
        periodeB={periodeB} schoolInfo={schoolInfo} moisAnnee={moisAnnee} maxNote={maxNote}
        avecEns={avecEns} eleves={eleves} canCreate={canCreate} canEdit={canEdit}
        getAppreciation={getAppreciation} setForm={setForm} setModal={setModal}
      />

      {modal==="apprec"&&(canCreate||canEdit)&&<AppreciationModale
        t={t} form={form} chg={chg} setForm={setForm} periodeB={periodeB}
        getAppreciation={getAppreciation} saveAppreciation={saveAppreciation} setModal={setModal}
      />}
    </div>
  );
}
