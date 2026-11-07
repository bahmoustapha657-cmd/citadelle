import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmtN } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";
import { CATEGORIES_PERSONNEL, libelleCategoriePersonnel, libelleStatutEleve } from "../../i18n/libelles";

export function PersonnelTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  personnel,
  cPers,
  supPers,
  savePersonnel,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("accounting.tabs.staff")} ({personnel.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({statut:"Actif"});setModal("add_p");}}>+ {t("common.add")}</Btn>}
      </div>

      {/* Cartes résumé */}
      {personnel.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        {CATEGORIES_PERSONNEL.map(cat=>{
          const n=personnel.filter(p=>p.categorie===cat).length;
          if(!n) return null;
          return <div key={cat} style={{background:"#f5f3ff",borderRadius:10,padding:"12px 14px",textAlign:"center",border:"1px solid #ddd6fe"}}>
            <div style={{fontSize:11,color:"#7c3aed",fontWeight:700,marginBottom:4}}>{libelleCategoriePersonnel(cat)}</div>
            <div style={{fontSize:20,fontWeight:900,color:C.blueDark}}>{n}</div>
          </div>;
        })}
        <div style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:10,padding:"12px 14px",textAlign:"center",color:"#fff"}}>
          <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{t("accounting.staff.monthlyMass")}</div>
          <div style={{fontSize:16,fontWeight:900}}>{(personnel.reduce((s,p)=>s+Number(p.salaireBase||0),0)/1e6).toFixed(3)}M</div>
          {/* i18n-ignore */}
          <div style={{fontSize:10,opacity:.75}}>GNF</div>
        </div>
      </div>}

      {cPers?<Chargement/>:personnel.length===0?<Vide icone="👥" msg={t("common.empty")}/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={[t("accounting.sal.cols.fullName"),t("accounting.sal.cols.post"),t("common.category"),t("accounting.sal.cols.baseSalary"),t("common.status"),t("accounting.sal.cols.observation"),canEdit?t("common.actions"):""]}/>
          <tbody>{personnel.map(p=><TR key={p._id}>
            <TD bold>{p.prenom||""} {p.nom||""}</TD>
            <TD>{p.poste||"—"}</TD>
            <TD><Badge color="purple">{libelleCategoriePersonnel(p.categorie)||"—"}</Badge></TD>
            <TD center>{fmtN(p.salaireBase||0)}</TD>
            <TD><Badge color={p.statut==="Actif"?"vert":"gray"}>{libelleStatutEleve(p.statut||"Actif")}</Badge></TD>
            <TD>{p.observation||"—"}</TD>
            {canEdit&&<TD center>
              <Btn sm v="ghost" onClick={()=>{setForm({...p});setModal("edit_p");}}>✏️</Btn>
              <Btn sm v="red" onClick={()=>confirm(t("accounting.staff.deleteConfirm"))&&supPers(p._id)}>🗑</Btn>
            </TD>}
          </TR>)}
          <tr style={{background:"#ede9fe",fontWeight:800}}>
            <td colSpan={3} style={{padding:"8px 12px",textAlign:"end",color:"#7c3aed"}}>{t("accounting.staff.totalMass")}</td>
            <td style={{padding:"8px 12px",textAlign:"center",color:"#7c3aed",fontSize:14}}>
              {fmtN(personnel.filter(p=>(p.statut||"Actif")==="Actif").reduce((s,p)=>s+Number(p.salaireBase||0),0))}
            </td>
            <td colSpan={canEdit?3:2}></td>
          </tr>
          </tbody>
        </table></div></Card>
      }

      {/* MODAL PERSONNEL */}
      {(modal==="add_p"&&canCreate||(modal==="edit_p"&&canEdit))&&<Modale large titre={modal==="add_p"?t("accounting.staff.newTitle"):t("accounting.staff.editTitle")} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Input label={t("common.name")} value={form.nom||""} onChange={chg("nom")}/>
          <Input label={t("common.firstName")} value={form.prenom||""} onChange={chg("prenom")}/>
          <Input label={t("accounting.sal.cols.post")} value={form.poste||""} onChange={chg("poste")} placeholder={t("accounting.sal.f.postPh")}/>
          <Selec label={t("common.category")} value={form.categorie||""} onChange={chg("categorie")}>
            <option value="">{t("accounting.sal.f.categoryPh")}</option>
            {CATEGORIES_PERSONNEL.map(c=><option key={c} value={c}>{libelleCategoriePersonnel(c)}</option>)}
          </Selec>
          <Input label={t("accounting.staff.baseSalaryField")} type="number" value={form.salaireBase||""} onChange={chg("salaireBase")} placeholder={t("accounting.staff.baseSalaryPh")}/>
          <Selec label={t("common.status")} value={form.statut||"Actif"} onChange={chg("statut")}>
            {/* i18n-ignore */}
            {["Actif","Inactif"].map(s=><option key={s} value={s}>{libelleStatutEleve(s)}</option>)}
          </Selec>
          <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.sal.cols.observation")} value={form.observation||""} onChange={chg("observation")}/></div>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"#f5f3ff",borderRadius:8,fontSize:12,color:"#7c3aed"}}>
          {t("accounting.staff.info")}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
          <Btn onClick={savePersonnel}>{t("common.save")}</Btn>
        </div>
      </Modale>}
    </div>
  );
}
