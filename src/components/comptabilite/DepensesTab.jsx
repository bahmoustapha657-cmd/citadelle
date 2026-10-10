import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, fmt } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";
import { imprimerEtatDepenses } from "../../reports/pieces-depenses";
import { filtrerDepensesParMois, libelleMois, moisDesDepenses, totalDepenses } from "./depenses-utils";

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
  periodes = ["T1", "T2", "T3"],
  defaultPeriode = "T1",
  anneeConsultee = "",
}) {
  const { t } = useTranslation();
  const { schoolInfo } = useContext(SchoolContext);
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  // Mois affiché et imprimé ("" = toute l'année). Un mois qui n'a plus de
  // dépense (la dernière supprimée) retombe sur l'état global.
  const [moisChoisi, setMoisChoisi] = useState("");
  const moisDispo = moisDesDepenses(depenses);
  const mois = moisDispo.includes(moisChoisi) ? moisChoisi : "";
  const affichees = filtrerDepensesParMois(depenses, mois);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:12}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("accounting.expensesTitle")} ({affichees.length})</strong>
        <div style={{flex:1}}/>
        <select value={mois} onChange={e=>setMoisChoisi(e.target.value)} aria-label="Mois des dépenses"
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",color:C.blueDark,fontWeight:700}}>
          <option value="">Tous les mois</option>
          {moisDispo.map(m=><option key={m} value={m}>{libelleMois(m)}</option>)}
        </select>
        <Btn v="vert" disabled={cD||affichees.length===0}
          title={mois?`Imprimer les dépenses de ${libelleMois(mois)}`:"Imprimer toutes les dépenses de l'année"}
          onClick={()=>imprimerEtatDepenses({depenses:affichees,schoolInfo,annee:anneeConsultee,mois})}>
          🖨️ {mois?`Imprimer ${libelleMois(mois)}`:"Imprimer l'état global"}
        </Btn>
        {canCreate&&<Btn onClick={()=>{setForm({periode:defaultPeriode});setModal("add_d");}}>{t("accounting.addExpense")}</Btn>}
      </div>
      {cD?<Chargement/>:affichees.length===0?<Vide icone="💸" msg={t("accounting.noExpense")}/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={[t("accounting.label"),t("accounting.categoryField"),t("accounting.period"),t("accounting.amountField"),t("accounting.dateField"),canEdit?t("common.actions"):""]}/>
          <tbody>{affichees.map(d=><TR key={d._id}>
            <TD bold>{d.libelle}</TD><TD><Badge color="red">{d.categorie}</Badge></TD>
            <TD>{d.periode}</TD><TD bold>{fmt(d.montant)}</TD><TD>{d.date}</TD>
            {canEdit&&<TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="ghost" onClick={()=>{setForm({...d});setModal("edit_d2");}}>{t("common.edit")}</Btn>
              <Btn sm v="danger" onClick={()=>{if(confirm(t("accounting.deleteConfirm")))supD(d._id);}}>{t("common.delete")}</Btn>
            </div></TD>}
          </TR>)}
          <tr style={{background:"#fce8e8",fontWeight:800}}>
            <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#9b2020"}}>TOTAL — {mois?libelleMois(mois):"tous les mois"}</td>
            <td style={{padding:"8px 12px",color:"#9b2020"}}>{fmt(totalDepenses(affichees))}</td>
            <td colSpan={2}></td>
          </tr></tbody>
        </table></div></Card>}
      {(modal==="add_d"&&canCreate||(modal==="edit_d2"&&canEdit))&&<Modale titre={modal==="add_d"?t("accounting.newExpenseTitle"):t("accounting.editTitle")} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.label")} value={form.libelle||""} onChange={chg("libelle")}/></div>
          <Selec label={t("accounting.categoryField")} value={form.categorie||""} onChange={chg("categorie")}><option>Salaires</option><option>Matériel</option><option>Infrastructure</option><option>Charges</option><option>Divers</option></Selec>
          <Input label={t("accounting.amountField")} type="number" value={form.montant||""} onChange={chg("montant")}/>
          <Input label={t("accounting.dateField")} type="date" value={form.date||""} onChange={chg("date")}/>
          <Selec label={t("accounting.period")} value={form.periode||defaultPeriode} onChange={chg("periode")}>{periodes.map(p=><option key={p} value={p}>{p}</option>)}</Selec>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn v="danger" onClick={()=>enreg(ajD,modD,{montant:Number(form.montant)})}>{t("common.save")}</Btn>
        </div>
      </Modale>}
    </div>
  );
}
