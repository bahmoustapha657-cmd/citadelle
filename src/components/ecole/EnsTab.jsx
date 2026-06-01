import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn } from "../ui";
import { useEnsTab } from "./ens-tab/use-ens-tab";
import { EnsListe } from "./ens-tab/EnsListe";
import { EnsCompteModale } from "./ens-tab/EnsCompteModale";
import { EnsFormModale } from "./ens-tab/EnsFormModale";

export function EnsTab({
  ens, cEns, supEns, cleEns, isPrimarySection, couleur, schoolId, toast, logAction,
  form, setForm, modal, setModal, canCreate, canEdit,
  ensCompte, setEnsCompte, formC, setFormC, saveEnseignant,
}) {
  const { t } = useTranslation();
  const { chg, chgC, sectionEns, ouvrirCompteEns, creerCompteEns } = useEnsTab({
    cleEns, schoolId, toast, logAction, ensCompte, setEnsCompte, formC, setFormC, setForm,
  });

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <strong style={{fontSize:14,color:C.blueDark}}>{t("school.teachers.title")} ({ens.length})</strong>
      {canCreate&&<Btn onClick={()=>{setForm({statut:"Titulaire"});setModal("add_ens");}}>+ {t("common.add")}</Btn>}
    </div>

    <EnsListe
      ens={ens} cEns={cEns} couleur={couleur} isPrimarySection={isPrimarySection}
      canEdit={canEdit} supEns={supEns} setForm={setForm} setModal={setModal}
      ouvrirCompteEns={ouvrirCompteEns} t={t}
    />

    <EnsCompteModale
      ensCompte={ensCompte} setEnsCompte={setEnsCompte} sectionEns={sectionEns}
      formC={formC} chgC={chgC} setFormC={setFormC} creerCompteEns={creerCompteEns}
    />

    <EnsFormModale
      modal={modal} setModal={setModal} canCreate={canCreate} canEdit={canEdit}
      form={form} setForm={setForm} chg={chg} cleEns={cleEns} saveEnseignant={saveEnseignant}
    />
  </div>;
}
