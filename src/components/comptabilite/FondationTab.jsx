import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, fmt } from "../../constants";
import { Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";
import { imprimerSituationVersements } from "../../reports/situation-versements";
import { BENEFICIAIRES, dateCourte, filtrerVersements, resumeVersements } from "./fondation/versements-utils";

// Versements du comptable : l'argent de la caisse remis à la banque ou à la
// Fondation. Les filtres (période, bénéficiaire) règlent à la fois la liste
// affichée et la situation imprimée ; chaque ligne s'imprime aussi seule.
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
  schoolInfo = {},
  annee = "",
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const [filtre, setFiltre] = useState({ du: "", au: "", beneficiaire: "" });
  const chgFiltre = (k) => (e) => setFiltre((p) => ({ ...p, [k]: e.target.value }));
  const filtreActif = !!(filtre.du || filtre.au || filtre.beneficiaire);
  const affiches = useMemo(() => filtrerVersements(versements, filtre), [versements, filtre]);
  const { total } = resumeVersements(affiches);
  const imprimer = (liste, params) => imprimerSituationVersements({ versements: liste, schoolInfo, annee, ...params });
  const champFiltre = { border: "1px solid #b0c4d8", borderRadius: 7, padding: "5px 8px", fontSize: 12, background: "#fff", color: C.blueDark };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark}}>{t("accounting.tabs.donations")} ({versements.length})</strong>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Btn v="amber" onClick={() => imprimer(affiches, filtre)} disabled={affiches.length === 0}
            title="Imprimer la situation des versements affichés (période et bénéficiaire choisis)">🖨️ Imprimer la situation</Btn>
          {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_v");}}>+ {t("common.new")}</Btn>}
        </div>
      </div>

      {versements.length > 0 && (
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:12,padding:"8px 12px",background:"#f1f5f9",borderRadius:8,fontSize:12}}>
          <label style={{fontWeight:600,color:"#475569"}}>Du</label>
          <input type="date" value={filtre.du} onChange={chgFiltre("du")} style={champFiltre}/>
          <label style={{fontWeight:600,color:"#475569"}}>au</label>
          <input type="date" value={filtre.au} onChange={chgFiltre("au")} style={champFiltre}/>
          <select value={filtre.beneficiaire} onChange={chgFiltre("beneficiaire")} style={champFiltre}>
            <option value="">Tous les bénéficiaires</option>
            {BENEFICIAIRES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {filtreActif && <Btn sm v="ghost" onClick={() => setFiltre({ du: "", au: "", beneficiaire: "" })}>✕ Tout afficher</Btn>}
          <span style={{marginInlineStart:"auto",fontWeight:700,color:C.blueDark}}>
            {affiches.length} versement(s) · Total : <span style={{color:C.blue}}>{fmt(total)}</span>
          </span>
        </div>
      )}

      {cV?<Chargement/>:versements.length===0?<Vide icone="🏛️" msg={t("common.empty")}/>
        :affiches.length===0?<Vide icone="🔎" msg="Aucun versement pour ces filtres"/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={[t("accounting.dateField"),t("accounting.label"),"Bénéficiaire","Référence",t("common.description"),t("accounting.amountField"),t("common.actions")]}/>
          <tbody>{affiches.map(v=><TR key={v._id}>
            <TD>{dateCourte(v.date)}</TD>
            <TD bold>{v.libelle}</TD>
            <TD>{v.beneficiaire || "—"}</TD>
            <TD>{v.reference || "—"}</TD>
            <TD>{v.description}</TD>
            <TD><span style={{color:C.blue,fontWeight:700}}>{fmt(v.montant)}</span></TD>
            <TD><div style={{display:"flex",gap:6}}>
              <Btn sm v="amber" title="Imprimer la situation de ce versement" onClick={() => imprimer([v], {})}>🖨️</Btn>
              {canEdit&&<>
                <Btn sm v="ghost" onClick={()=>{setForm({...v});setModal("edit_v");}}>{t("common.edit")}</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm(t("accounting.deleteConfirm")))supV(v._id);}}>{t("common.delete")}</Btn>
              </>}
            </div></TD>
          </TR>)}</tbody>
        </table></div></Card>}
      {(modal==="add_v"&&canCreate||(modal==="edit_v"&&canEdit))&&<Modale titre={modal==="add_v"?t("common.new"):t("accounting.editTitle")} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.label")} value={form.libelle||""} onChange={chg("libelle")}/></div>
          <Selec label="Bénéficiaire" value={form.beneficiaire||""} onChange={chg("beneficiaire")}>
            <option value="">— Choisir —</option>
            {BENEFICIAIRES.map((b) => <option key={b} value={b}>{b}</option>)}
          </Selec>
          <Input label="Référence (n° de bordereau ou de reçu)" value={form.reference||""} onChange={chg("reference")}/>
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
