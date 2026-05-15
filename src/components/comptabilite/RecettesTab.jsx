import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmt } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";

export function RecettesTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  recettes,
  cR,
  ajR,
  modR,
  supR,
  enreg,
  periodes = ["T1", "T2", "T3"],
  defaultPeriode = "T1",
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("accounting.revenuesTitle")} ({recettes.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({periode:defaultPeriode});setModal("add_r");}}>{t("accounting.addRevenue")}</Btn>}
      </div>
      {cR?<Chargement/>:recettes.length===0?<Vide icone="💰" msg={t("accounting.noRevenue")}/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={[t("accounting.label"),t("accounting.categoryField"),t("accounting.period"),t("accounting.amountField"),t("accounting.dateField"),canEdit?t("common.actions"):""]}/>
          <tbody>{recettes.map(r=><TR key={r._id}>
            <TD bold>{r.libelle}</TD><TD><Badge color="vert">{r.categorie}</Badge></TD>
            <TD>{r.periode}</TD><TD bold>{fmt(r.montant)}</TD><TD>{r.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...r});setModal("edit_r");}}>{t("common.edit")}</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm(t("accounting.deleteConfirm")))supR(r._id);}}>{t("common.delete")}</Btn>
            </div></TD>}
          </TR>)}</tbody>
        </table></Card>}
      {(modal==="add_r"&&canCreate||(modal==="edit_r"&&canEdit))&&<Modale titre={modal==="add_r"?t("accounting.newRevenueTitle"):t("accounting.editTitle")} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.label")} value={form.libelle||""} onChange={chg("libelle")}/></div>
          <Selec label={t("accounting.categoryField")} value={form.categorie||""} onChange={chg("categorie")}><option>Scolarité</option><option>Inscription</option><option>Examens</option><option>Activités</option><option>Don</option></Selec>
          <Input label={t("accounting.amountField")} type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label={t("accounting.dateField")} type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label={t("accounting.period")} value={form.periode||defaultPeriode} onChange={chg("periode")}>{periodes.map(p=><option key={p} value={p}>{p}</option>)}</Selec>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn v="success" onClick={()=>enreg(ajR,modR,{montant:Number(form.montant)})}>{t("common.save")}</Btn>
        </div>
      </Modale>}
    </div>
  );
}
