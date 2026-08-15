import { useState } from "react";
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
  // Un surveillant travaille classe par classe : sans ce filtre, il devait
  // lire toute l'école pour retrouver les absences d'une seule.
  const [classeFiltre, setClasseFiltre] = useState("all");

  // Classes tirées des ÉLÈVES, pas des absences : une classe sans incident
  // doit rester sélectionnable (c'est même l'information utile).
  const classes = [...new Set(eleves.map((e) => e.classe).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
  const elevesFiltres = classeFiltre === "all" ? eleves : eleves.filter((e) => e.classe === classeFiltre);
  // L'absence porte sa classe, mais celle de l'élève fait foi : un élève
  // changé de classe en cours d'année ne doit pas disparaître du filtre.
  const idsClasse = new Set(elevesFiltres.map((e) => e._id));
  const absencesFiltrees = classeFiltre === "all"
    ? absences
    : absences.filter((a) => idsClasse.has(a.eleveId) || a.classe === classeFiltre);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>
          {t("school.discipline.title")} & {t("dashboard.absences")} ({absencesFiltrees.length}
          {classeFiltre!=="all"?` / ${absences.length}`:""})
        </strong>
        {classes.length>0&&(
          <select value={classeFiltre} onChange={(e)=>setClasseFiltre(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,
              background:"#fff",color:C.blueDark,fontWeight:600}}>
            <option value="all">Toutes les classes ({eleves.length} élèves)</option>
            {classes.map((c)=>(
              <option key={c} value={c}>{c} ({eleves.filter((e)=>e.classe===c).length})</option>
            ))}
          </select>
        )}
        <Btn sm v="ghost" onClick={()=>exportExcel(
          `${t("reports.excel.files.discipline")}_${avecEns?"College":"Primaire"}${classeFiltre!=="all"?`_${classeFiltre}`:""}`,
          [t("reports.excel.headers.student"),t("reports.excel.headers.class"),t("reports.excel.headers.type"),t("reports.excel.headers.date"),t("reports.excel.headers.motive"),t("reports.excel.headers.justified")],
          absencesFiltrees.map(a=>[a.eleveNom,a.classe,a.type,a.date,a.motif||"",a.justifie])
        )}>📥 {t("common.export")} Excel</Btn>
        {canCreate&&<Btn onClick={()=>{setForm({type:"Absence",justifie:"Non",classe:classeFiltre==="all"?"":classeFiltre});setModal("add_abs");}}>+ Enregistrer</Btn>}
      </div>

      <DisciplineAlertes eleves={elevesFiltres} absences={absencesFiltrees} t={t}/>

      <DisciplineTable absences={absencesFiltrees} cAbs={cAbs} supAbs={supAbs} canEdit={canEdit}/>

      {modal==="add_abs"&&canCreate&&<DisciplineModale form={form} setForm={setForm} chg={chg} eleves={elevesFiltres} ajAbs={ajAbs} setModal={setModal} envoyerPush={envoyerPush}/>}
    </div>
  );
}
