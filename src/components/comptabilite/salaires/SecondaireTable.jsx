import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmtN, getAnnee } from "../../../constants";
import { Btn } from "../../ui";

export function SecondaireTable({ salairesSec, canEdit, readOnly, calcExecute, calcMontant, calcNet, modS, supS, setForm, setModal, totNetSec, moisLabel, annee }) {
  const { t } = useTranslation();
  return (
    <>
      <div style={{background:C.blue,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13}}>
        {t("accounting.section").toUpperCase()} {t("dashboard.secondary").toUpperCase()} — {moisLabel} {annee||getAnnee()}
      </div>
      {/* Sticky : header (top) + colonnes N° et Nom (left). Le wrapper passe
          en overflow:auto avec une hauteur max pour activer le sticky-top
          sans dépendre du scroll de la page. */}
      <div style={{overflow:"auto",marginBottom:16,maxHeight:"calc(100vh - 360px)",minHeight:280}}>
        <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,minWidth:900}}>
          {(()=>{
            const thBase = {padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",background:"#e0ebf8"};
            // Hauteur approx d'une ligne de header (10px font + padding) → 2e ligne sticky en dessous.
            const ROW1_H = 34;
            return (
              <thead>
                <tr>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",position:"sticky",top:0,left:0,zIndex:4}}>N°</th>
                  <th rowSpan={2} style={{...thBase,position:"sticky",top:0,left:40,zIndex:4}}>Prénoms et Nom</th>
                  <th rowSpan={2} style={{...thBase,position:"sticky",top:0,zIndex:3}}>Matière</th>
                  <th rowSpan={2} style={{...thBase,position:"sticky",top:0,zIndex:3}}>Niveau</th>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",position:"sticky",top:0,zIndex:3}}>V.H.<br/>Hebdo</th>
                  <th colSpan={4} style={{...thBase,textAlign:"center",position:"sticky",top:0,zIndex:3}}>V.H. Mensuel</th>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",position:"sticky",top:0,zIndex:3}}>Prime<br/>Horaire</th>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",position:"sticky",top:0,zIndex:3}}>Montant</th>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",position:"sticky",top:0,zIndex:3}}>Bon</th>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",background:"#fef3e0",position:"sticky",top:0,zIndex:3}}>Révision</th>
                  <th rowSpan={2} style={{...thBase,textAlign:"center",background:"#eaf4e0",position:"sticky",top:0,zIndex:3}}>Net à<br/>Payer</th>
                  <th rowSpan={2} style={{...thBase,position:"sticky",top:0,zIndex:3}}>Obs.</th>
                  {canEdit&&<th rowSpan={2} style={{...thBase,position:"sticky",top:0,zIndex:3}}>Act.</th>}
                </tr>
                <tr>
                  {["Prévu","5è Sem","Non Exé.","Exécuté"].map(h=><th key={h} style={{...thBase,padding:"5px 8px",textAlign:"center",position:"sticky",top:ROW1_H,zIndex:3}}>{h}</th>)}
                </tr>
              </thead>
            );
          })()}
          <tbody>
            {salairesSec.length===0?
              <tr><td colSpan={canEdit?15:14} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>Aucun enseignant secondaire pour ce mois</td></tr>
              :salairesSec.map((s,i)=>{
                const rowBg = i%2===0?"#fff":"#f9fbf9";
                return (
                <tr key={s._id} style={{borderBottom:"1px solid #e8f0e8",background:rowBg}}>
                  <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8",position:"sticky",left:0,background:rowBg,zIndex:1}}>{i+1}</td>
                  <td style={{padding:"7px 10px",fontWeight:700,fontSize:12,color:C.blueDark,border:"1px solid #e8f0e8",position:"sticky",left:40,background:rowBg,zIndex:1,boxShadow:"inset -1px 0 0 #d1dce8"}}>{s.nom}</td>
                  <td style={{padding:"7px 10px",fontSize:12,border:"1px solid #e8f0e8"}}>{s.matiere}</td>
                  <td style={{padding:"7px 10px",fontSize:12,border:"1px solid #e8f0e8"}}>{s.niveau}</td>
                  <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.vhHebdo||0}</td>
                  <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.vhPrevu||0}</td>
                  <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.cinqSem||0}</td>
                  <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{s.nonExecute||0}</td>
                  <td style={{padding:"7px 10px",textAlign:"center",fontWeight:700,fontSize:12,border:"1px solid #e8f0e8",background:"#f0f8ff"}}>{calcExecute(s)}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",fontSize:12,border:"1px solid #e8f0e8"}} title={s.primesVariables?"Primes par classe — voir observation":""}>{s.primesVariables?<span style={{color:"#9a3412",fontWeight:700,fontSize:11}}>Variable</span>:fmtN(s.primeHoraire)}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",fontSize:12,border:"1px solid #e8f0e8"}}>{fmtN(calcMontant(s))}</td>
                  <td style={{padding:"7px 10px",textAlign:"right",fontSize:12,color:"#b91c1c",border:"1px solid #e8f0e8"}}>{fmtN(s.bon||0)}</td>
                  <td style={{padding:"4px 6px",textAlign:"center",border:"1px solid #e8f0e8",background:"#fffbeb"}}>
                    {canEdit
                      ?<input type="number" value={s.revision||0} onChange={e=>modS({...s,revision:Number(e.target.value)})}
                        style={{width:80,border:"1px solid #fbbf24",borderRadius:5,padding:"3px 5px",fontSize:11,textAlign:"right"}}/>
                      :<span style={{fontSize:12}}>{fmtN(s.revision||0)}</span>}
                  </td>
                  <td style={{padding:"7px 10px",textAlign:"right",fontWeight:800,fontSize:13,color:C.greenDk,background:"#eaf4e0",border:"1px solid #b0c4d8"}}>{fmtN(calcNet(s))}</td>
                  <td
                    title={s.observation||""}
                    style={{padding:"7px 10px",fontSize:11,color:"#6b7280",border:"1px solid #e8f0e8",maxWidth:280,whiteSpace:"normal",lineHeight:1.4}}
                  >
                    {s.observation}
                  </td>
                  {canEdit&&<td style={{padding:"7px 6px",border:"1px solid #e8f0e8"}}>
                    <div style={{display:"flex",gap:4}}>
                      <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                      <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supS(s._id);}}>×</Btn>
                    </div>
                  </td>}
                </tr>
              );})}
            <tr style={{background:"#e0ebf8",fontWeight:800}}>
              <td colSpan={13} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark,border:"1px solid #b0c4d8"}}>TOTAL NET SECONDAIRE</td>
              <td style={{padding:"8px 12px",textAlign:"right",color:C.greenDk,fontSize:14,border:"1px solid #b0c4d8"}}>{fmtN(totNetSec)}</td>
              <td colSpan={readOnly?1:2} style={{border:"1px solid #b0c4d8"}}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
