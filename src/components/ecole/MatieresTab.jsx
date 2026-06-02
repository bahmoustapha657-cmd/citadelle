import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn } from "../ui";
import { MatieresTable } from "./matieres-tab/MatieresTable";
import { MatiereAddModale } from "./matieres-tab/MatiereAddModale";
import { MatiereEditModale } from "./matieres-tab/MatiereEditModale";

export function MatieresTab({
  matieres, cMat, ajMat, modMat, supMat, classes, matieresPredefinies,
  form, setForm, modal, setModal, canCreate, canEdit,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("school.subjects.title")} ({matieres.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({coefficient:1});setModal("add_mat");}}>+ {t("common.add")}</Btn>}
      </div>
      {canCreate&&matieres.length===0&&matieresPredefinies.length>0&&<div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:16}}>💡</span>
        <span style={{fontSize:13,color:"#166534",flex:1}}>Des matières prédéfinies sont disponibles pour ce niveau.</span>
        <Btn v="success" onClick={()=>matieresPredefinies.forEach(m=>ajMat(m))}>✅ Initialiser les matières</Btn>
      </div>}
      {/* Légende */}
      <div style={{background:"#f0f7ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:12,color:"#1e40af"}}>
        💡 Si une matière n'est assignée à <strong>aucune classe</strong>, elle apparaît dans <strong>toutes les classes</strong>. Sinon, elle n'apparaît que dans les classes sélectionnées.
      </div>

      <MatieresTable matieres={matieres} cMat={cMat} supMat={supMat} canEdit={canEdit}
        setForm={setForm} setModal={setModal} noSubjectMsg={t("school.subjects.noSubject")}/>

      {modal==="add_mat"&&canCreate&&<MatiereAddModale form={form} setForm={setForm} chg={chg} classes={classes} ajMat={ajMat} setModal={setModal}/>}

      {modal&&modal.startsWith("edit_mat_")&&canEdit&&<MatiereEditModale modal={modal} matieres={matieres} form={form} setForm={setForm} chg={chg} classes={classes} modMat={modMat} setModal={setModal}/>}
    </div>
  );
}
