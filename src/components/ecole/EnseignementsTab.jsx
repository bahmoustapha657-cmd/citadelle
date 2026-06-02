import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn } from "../ui";
import { EnseignementsStats } from "./enseignements-tab/EnseignementsStats";
import { EnseignementsTable } from "./enseignements-tab/EnseignementsTable";
import { EnseignementsModale } from "./enseignements-tab/EnseignementsModale";

export function EnseignementsTab({
  enseignements, cEng, ajEng, modEng, supEng, classes, ens, matieres,
  form, setForm, modal, setModal, canCreate, canEdit,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("school.teachings.title")} ({enseignements.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({type:"Cours",statut:"Effectué"});setModal("add_eng");}}>+ {t("common.add")}</Btn>}
      </div>

      <EnseignementsStats enseignements={enseignements}/>

      <EnseignementsTable enseignements={enseignements} cEng={cEng} supEng={supEng} canEdit={canEdit} setForm={setForm} setModal={setModal}/>

      {(modal==="add_eng"&&canCreate||(modal==="edit_eng"&&canEdit))&&<EnseignementsModale
        form={form} chg={chg} modal={modal} setModal={setModal}
        ens={ens} matieres={matieres} classes={classes} ajEng={ajEng} modEng={modEng}
      />}
    </div>
  );
}
