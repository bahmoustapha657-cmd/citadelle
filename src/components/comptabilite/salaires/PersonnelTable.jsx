import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmtN, getAnnee } from "../../../constants";
import { Badge, Btn, TD, THead, TR } from "../../ui";
import { libelleCategoriePersonnel } from "../../../i18n/libelles";

export function PersonnelTable({ salairesPers, canEdit, calcNetF, supS, setForm, setModal, totNetSec, totNetPrim, totNetPers, moisLabel, annee }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{background:"#7c3aed",color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10}}>
        <span style={{flex:1}}>{t("accounting.section").toUpperCase()} {t("accounting.tabs.staff").toUpperCase()} — {moisLabel} {annee||getAnnee()}</span>
      </div>
      <div className="lc-sticky-wrap" style={{marginBottom:8}}>
        <table className="lc-sticky-table" data-fix-left="2" style={{"--col2-left":"50px"}}>
          <THead cols={[t("accounting.sal.cols.n"),t("accounting.sal.cols.fullName"),t("accounting.sal.cols.post"),t("common.category"),t("accounting.sal.cols.baseSalary"),t("accounting.salaryBonus"),t("accounting.sal.cols.abs"),t("accounting.salaryRevision"),t("accounting.sal.cols.netPay"),t("accounting.sal.cols.observation"),canEdit?t("common.actions"):""]}/>
          <tbody>
            {salairesPers.length===0
              ?<tr><td colSpan={canEdit?11:10} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>{t("accounting.sal.noEmployee")}</td></tr>
              :salairesPers.map((s,i)=>(
                <TR key={s._id}>
                  <TD center>{i+1}</TD>
                  <TD bold>{s.nom}</TD>
                  <TD>{s.poste||"—"}</TD>
                  <TD><Badge color="purple">{libelleCategoriePersonnel(s.categorie)||"—"}</Badge></TD>
                  <TD center>{fmtN(s.montantForfait||0)}</TD>
                  <TD center style={{color:"#b91c1c"}}>{fmtN(s.bon||0)}</TD>
                  <TD center style={{color:"#b91c1c"}} title={s.detailAbsences||""}>{Number(s.retenueAbsences||0)?`-${fmtN(s.retenueAbsences)}`:"—"}</TD>
                  <TD center style={{color:C.greenDk}}>{fmtN(s.revision||0)}</TD>
                  <TD center><strong style={{color:C.greenDk}}>{fmtN(calcNetF(s))}</strong></TD>
                  <TD>{s.observation||""}</TD>
                  {canEdit&&<TD center>
                    <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                    <Btn sm v="red" onClick={()=>confirm(t("accounting.deleteConfirm"))&&supS(s._id)}>🗑</Btn>
                  </TD>}
                </TR>
              ))
            }
            <tr style={{background:"#ede9fe",fontWeight:800}}>
              <td colSpan={8} style={{padding:"8px 12px",textAlign:"end",color:"#7c3aed"}}>{t("accounting.sal.totalNetStaff")}</td>
              <td style={{padding:"8px 12px",textAlign:"center",color:"#7c3aed",fontSize:14}}>{fmtN(totNetPers)}</td>
              <td colSpan={canEdit?2:1}></td>
            </tr>
            <tr style={{background:C.blue,color:"#fff",fontWeight:900}}>
              <td colSpan={8} style={{padding:"10px 12px",textAlign:"end",fontSize:14,letterSpacing:".4px"}}>{t("accounting.sal.grandTotal")}</td>
              {/* i18n-ignore */}
              <td style={{padding:"10px 12px",textAlign:"center",fontSize:16,fontWeight:900}}>{fmtN(totNetSec+totNetPrim+totNetPers)} GNF</td>
              <td colSpan={canEdit?2:1}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
