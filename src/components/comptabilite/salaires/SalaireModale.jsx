import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmtN } from "../../../constants";
import { Btn, Input, Modale, Selec } from "../../ui";
import { sectionsPaieProposees } from "./bon-agents";
import { CATEGORIES_PERSONNEL, libelleCategoriePersonnel, libelleMois, libelleSectionPaie } from "../../../i18n/libelles";

export function SalaireModale({ modal, canCreate, canEdit, form, setForm, setModal, moisModale, moisSalaire, calcExecute, calcMontant, calcNet, saveSalaire, groupesPaie }) {
  const { t } = useTranslation();
  if (!((modal==="add_s"&&canCreate)||(modal==="edit_s"&&canEdit))) return null;
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const sections = sectionsPaieProposees(groupesPaie, form.section);
  return (
    <Modale large titre={modal==="add_s"?t("accounting.sal.newTitle"):t("accounting.sal.editTitle")} fermer={()=>setModal(null)}>
      <div style={{marginBottom:14}}>
        <Selec label={t("accounting.section")} value={form.section||sections[0]} onChange={chg("section")}>
          {sections.map(s=><option key={s} value={s}>{libelleSectionPaie(s)}</option>)}
        </Selec>
      </div>
      <Selec label={t("accounting.month")} value={form.mois||moisModale} onChange={chg("mois")}>
        {moisSalaire.map(m=><option key={m} value={m}>{libelleMois(m)}</option>)}
      </Selec>
      <div style={{height:12}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.sal.cols.fullName")} value={form.nom||""} onChange={chg("nom")}/></div>
        {form.section==="Secondaire"?<>
          <Input label={t("accounting.sal.cols.subject")} value={form.matiere||""} onChange={chg("matiere")}/>
          <Input label={t("accounting.sal.cols.level")} value={form.niveau||""} onChange={chg("niveau")}/>
          <Input label={t("accounting.sal.f.vhWeekly")} type="number" value={form.vhHebdo||""} onChange={e=>{const v=Number(e.target.value);setForm(p=>({...p,vhHebdo:v,vhPrevu:v*4}));}}/>
          <Input label={t("accounting.sal.f.vhPlanned")} type="number" value={form.vhPrevu||""} onChange={chg("vhPrevu")}/>
          <Input label={t("accounting.sal.f.fifthWeek")} type="number" value={form.cinqSem||0} onChange={chg("cinqSem")}/>
          <Input label={t("accounting.sal.f.notDone")} type="number" value={form.nonExecute||0} onChange={chg("nonExecute")}/>
          <Input label={t("accounting.sal.f.hourlyRate")} type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")}/>
          <Input label={t("accounting.sal.f.advance")} type="number" value={form.bon||0} onChange={chg("bon")}/>
          <Input label={t("accounting.sal.f.adjustment")} type="number" value={form.revision||0} onChange={chg("revision")}/>
        </>:form.section==="Personnel"?<>
          <Input label={t("accounting.sal.cols.post")} value={form.poste||""} onChange={chg("poste")} placeholder={t("accounting.sal.f.postPh")}/>
          <Selec label={t("common.category")} value={form.categorie||""} onChange={chg("categorie")}>
            <option value="">{t("accounting.sal.f.categoryPh")}</option>
            {CATEGORIES_PERSONNEL.map(c=><option key={c} value={c}>{libelleCategoriePersonnel(c)}</option>)}
          </Selec>
          <Input label={t("accounting.sal.f.baseSalary")} type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
          <Input label={t("accounting.sal.f.advance")} type="number" value={form.bon||0} onChange={chg("bon")}/>
          <Input label={t("accounting.sal.f.adjustment")} type="number" value={form.revision||0} onChange={chg("revision")}/>
        </>:<>
          <Input label={t("accounting.cols.class")} value={form.niveau||""} onChange={chg("niveau")}/>
          <Input label={t("accounting.sal.f.flatAmount")} type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
          <Input label={t("accounting.sal.f.advance")} type="number" value={form.bon||0} onChange={chg("bon")}/>
          <Input label={t("accounting.sal.f.adjustment")} type="number" value={form.revision||0} onChange={chg("revision")}/>
        </>}
        <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.sal.cols.observation")} value={form.observation||""} onChange={chg("observation")}/></div>
      </div>
      {form.section==="Secondaire"&&<div style={{marginTop:12,padding:"10px 14px",background:"#e0ebf8",borderRadius:8,fontSize:13}}>
        <strong>{t("accounting.sal.previewLabel")}</strong> {t("accounting.sal.previewDone",{hours:calcExecute(form)})} &nbsp;|&nbsp;
        {t("accounting.sal.previewAmount",{amount:fmtN(calcMontant(form))})} &nbsp;|&nbsp;
        {t("accounting.sal.previewAdvance",{amount:fmtN(form.bon||0)})} &nbsp;|&nbsp;
        {t("accounting.sal.previewAdjust",{amount:fmtN(form.revision||0)})} &nbsp;|&nbsp;
        <strong style={{color:C.greenDk}}>{t("accounting.sal.previewNet",{amount:fmtN(calcNet(form))})}</strong>
      </div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
        <Btn onClick={()=>saveSalaire({vhHebdo:Number(form.vhHebdo||0),vhPrevu:Number(form.vhPrevu||0),cinqSem:Number(form.cinqSem||0),nonExecute:Number(form.nonExecute||0),primeHoraire:Number(form.primeHoraire||0),bon:Number(form.bon||0),revision:Number(form.revision||0),montantForfait:Number(form.montantForfait||0),montantBrut:null,primesVariables:false})}>{t("common.save")}</Btn>
      </div>
    </Modale>
  );
}
