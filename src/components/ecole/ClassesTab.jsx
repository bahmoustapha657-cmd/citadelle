import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn } from "../ui";
import { syncClassesFromData } from "./classes-tab/sync-classes";
import { ClassesTable } from "./classes-tab/ClassesTable";
import { ClasseModale } from "./classes-tab/ClasseModale";

export function ClassesTab({
  classes, eleves, ens, cC, ajC, modC, supC, schoolInfo,
  form, setForm, modal, setModal, canCreate, canEdit,
  classesPredefinies, effectifReel, saveClasse, toast,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("school.classes.title")} ({classes.length})</strong>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {canCreate&&<Btn v="ghost" onClick={()=>syncClassesFromData({eleves,ens,classes,ajC,modC,toast})}>🔄 Synchroniser depuis élèves & enseignants</Btn>}
          {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_c");}}>{t("school.classes.addClass")}</Btn>}
        </div>
      </div>

      <ClassesTable
        classes={classes} cC={cC} eleves={eleves} schoolInfo={schoolInfo} effectifReel={effectifReel}
        supC={supC} canEdit={canEdit} setForm={setForm} setModal={setModal} noClassMsg={t("school.classes.noClass")}
      />

      {(modal==="add_c"&&canCreate||(modal==="edit_c"&&canEdit))&&<ClasseModale
        form={form} setForm={setForm} chg={chg} modal={modal} setModal={setModal}
        classes={classes} classesPredefinies={classesPredefinies} saveClasse={saveClasse}
      />}
    </div>
  );
}
