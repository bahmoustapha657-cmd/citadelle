import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmt } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";

export function DepensesTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  depenses,
  cD,
  ajD,
  modD,
  supD,
  enreg,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("accounting.expensesTitle")} ({depenses.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({periode:"T1"});setModal("add_d");}}>{t("accounting.addExpense")}</Btn>}
      </div>
      {cD?<Chargement/>:depenses.length===0?<Vide icone="💸" msg={t("accounting.noExpense")}/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={[t("accounting.label"),t("accounting.categoryField"),t("accounting.period"),t("accounting.amountField"),t("accounting.dateField"),canEdit?t("common.actions"):""]}/>
          <tbody>{depenses.map(d=><TR key={d._id}>
            <TD bold>{d.libelle}</TD><TD><Badge color="red">{d.categorie}</Badge></TD>
            <TD>{d.periode}</TD><TD bold>{fmt(d.montant)}</TD><TD>{d.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...d});setModal("edit_d2");}}>{t("common.edit")}</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm(t("accounting.deleteConfirm")))supD(d._id);}}>{t("common.delete")}</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_d"&&canCreate||(modal==="edit_d2"&&canEdit))&&<Modale titre={modal==="add_d"?t("accounting.newExpenseTitle"):t("accounting.editTitle")} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.label")} value={form.libelle||""} onChange={chg("libelle")}/></div>
          <Selec label={t("accounting.categoryField")} value={form.categorie||""} onChange={chg("categorie")}><option>Salaires</option><option>Matériel</option><option>Infrastructure</option><option>Charges</option><option>Divers</option></Selec>
          <Input label={t("accounting.amountField")} type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label={t("accounting.dateField")} type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label={t("accounting.period")} value={form.periode||"T1"} onChange={chg("periode")}><option>T1</option><option>T2</option><option>T3</option></Selec>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn v="danger" onClick={()=>enreg(ajD,modD,{montant:Number(form.montant)})}>{t("common.save")}</Btn>
        </div>
      </Modale>}
    </div>
  );
}
