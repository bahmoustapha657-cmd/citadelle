import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmt } from "../../constants";
import { Btn, Card, Chargement, Input, Modale, TD, THead, TR, Vide } from "../ui";

export function FondationTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  versements,
  cV,
  ajV,
  modV,
  supV,
  enreg,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("accounting.tabs.donations")} ({versements.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_v");}}>+ {t("common.new")}</Btn>}
      </div>
      {cV?<Chargement/>:versements.length===0?<Vide icone="🏛️" msg={t("common.empty")}/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={[t("accounting.label"),t("common.description"),t("accounting.amountField"),t("accounting.dateField"),canEdit?t("common.actions"):""]}/>
          <tbody>{versements.map(v=><TR key={v._id}>
            <TD bold>{v.libelle}</TD><TD>{v.description}</TD>
            <TD><span style={{color:C.blue,fontWeight:700}}>{fmt(v.montant)}</span></TD><TD>{v.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...v});setModal("edit_v");}}>{t("common.edit")}</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm(t("accounting.deleteConfirm")))supV(v._id);}}>{t("common.delete")}</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_v"&&canCreate||(modal==="edit_v"&&canEdit))&&<Modale titre={modal==="add_v"?t("common.new"):t("accounting.editTitle")} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.label")} value={form.libelle||""} onChange={chg("libelle")}/></div>
          <div style={{gridColumn:"1/-1"}}><Input label={t("common.description")} value={form.description||""} onChange={chg("description")}/></div>
          <Input label={t("accounting.amountField")} type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label={t("accounting.dateField")} type="date" value={form.date||""} onChange={chg("date")}/>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn v="vert" onClick={()=>enreg(ajV,modV,{montant:Number(form.montant)})}>{t("common.save")}</Btn>
        </div>
      </Modale>}
    </div>
  );
}
