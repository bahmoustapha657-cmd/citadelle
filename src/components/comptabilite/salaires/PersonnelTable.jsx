import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmtN, getAnnee } from "../../../constants";
import { Badge, Btn, TD, THead, TR } from "../../ui";

export function PersonnelTable({ salairesPers, canEdit, calcNetF, supS, setForm, setModal, totNetSec, totNetPrim, totNetPers, moisLabel, annee }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{background:"#7c3aed",color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10}}>
        <span style={{flex:1}}>{t("accounting.section").toUpperCase()} {t("accounting.tabs.staff").toUpperCase()} — {moisLabel} {annee||getAnnee()}</span>
      </div>
      <div className="lc-sticky-wrap" style={{marginBottom:8}}>
        <table className="lc-sticky-table" data-fix-left="2" style={{"--col2-left":"50px"}}>
          <THead cols={["N°","Prénoms et Nom","Poste","Catégorie","Salaire de base","Bon","Révision","Net à Payer","Observation",canEdit?"Actions":""]}/>
          <tbody>
            {salairesPers.length===0
              ?<tr><td colSpan={canEdit?10:9} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>Aucun employé pour ce mois</td></tr>
              :salairesPers.map((s,i)=>(
                <TR key={s._id}>
                  <TD center>{i+1}</TD>
                  <TD bold>{s.nom}</TD>
                  <TD>{s.poste||"—"}</TD>
                  <TD><Badge color="purple">{s.categorie||"—"}</Badge></TD>
                  <TD center>{fmtN(s.montantForfait||0)}</TD>
                  <TD center style={{color:"#b91c1c"}}>{fmtN(s.bon||0)}</TD>
                  <TD center style={{color:C.greenDk}}>{fmtN(s.revision||0)}</TD>
                  <TD center><strong style={{color:C.greenDk}}>{fmtN(calcNetF(s))}</strong></TD>
                  <TD>{s.observation||""}</TD>
                  {canEdit&&<TD center>
                    <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                    <Btn sm v="red" onClick={()=>confirm("Supprimer ?")&&supS(s._id)}>🗑</Btn>
                  </TD>}
                </TR>
              ))
            }
            <tr style={{background:"#ede9fe",fontWeight:800}}>
              <td colSpan={7} style={{padding:"8px 12px",textAlign:"right",color:"#7c3aed"}}>TOTAL NET PERSONNEL</td>
              <td style={{padding:"8px 12px",textAlign:"center",color:"#7c3aed",fontSize:14}}>{fmtN(totNetPers)}</td>
              <td colSpan={canEdit?2:1}></td>
            </tr>
            <tr style={{background:C.blue,color:"#fff",fontWeight:900}}>
              <td colSpan={7} style={{padding:"10px 12px",textAlign:"right",fontSize:14,letterSpacing:".4px"}}>TOTAL GÉNÉRAL NET À PAYER</td>
              <td style={{padding:"10px 12px",textAlign:"center",fontSize:16,fontWeight:900}}>{fmtN(totNetSec+totNetPrim+totNetPers)} GNF</td>
              <td colSpan={canEdit?2:1}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
