import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn } from "../ui";
import { exportExcel } from "../../reports";
import { DisciplineAlertes } from "./discipline-tab/DisciplineAlertes";
import { DisciplineTable } from "./discipline-tab/DisciplineTable";
import { DisciplineModale } from "./discipline-tab/DisciplineModale";

export function DisciplineTab({
  absences, cAbs, ajAbs, supAbs, eleves, avecEns,
  form, setForm, modal, setModal, canCreate, canEdit, envoyerPush,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("school.discipline.title")} & {t("dashboard.absences")} ({absences.length})</strong>
        <Btn sm v="ghost" onClick={()=>exportExcel(
          `${t("reports.excel.files.discipline")}_${avecEns?"College":"Primaire"}`,
          [t("reports.excel.headers.student"),t("reports.excel.headers.class"),t("reports.excel.headers.type"),t("reports.excel.headers.date"),t("reports.excel.headers.motive"),t("reports.excel.headers.justified")],
          absences.map(a=>[a.eleveNom,a.classe,a.type,a.date,a.motif||"",a.justifie])
        )}>📥 {t("common.export")} Excel</Btn>
        {canCreate&&<Btn onClick={()=>{setForm({type:"Absence",justifie:"Non"});setModal("add_abs");}}>+ Enregistrer</Btn>}
      </div>

      <DisciplineAlertes eleves={eleves} absences={absences} t={t}/>

      <DisciplineTable absences={absences} cAbs={cAbs} supAbs={supAbs} canEdit={canEdit}/>

      {modal==="add_abs"&&canCreate&&<DisciplineModale form={form} setForm={setForm} chg={chg} eleves={eleves} ajAbs={ajAbs} setModal={setModal} envoyerPush={envoyerPush}/>}
    </div>
  );
}
