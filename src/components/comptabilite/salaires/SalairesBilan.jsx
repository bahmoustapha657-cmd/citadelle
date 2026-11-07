import React from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, fmtN, getAnnee } from "../../../constants";
import { Card } from "../../ui";
import { getForfaitNet } from "../../../salary-utils";
import { libelleMoisCourt, libelleSectionPaie } from "../../../i18n/libelles";
import { localeCourante } from "../../../i18n";

// `groupesPaie` : groupes affichés (cf. SalairesTab) — une école sans
// secondaire n'a ni carte, ni part, ni barre « Secondaire ».
export function SalairesBilan({ totNetSec, totNetPrim, totNetPers, salairesMois, moisSalaire, salaires, calcNet, moisLabel, salairesSec, salairesPrim, salairesPers, annee, groupesPaie = { secondaire: true, primaire: true } }) {
  const { t } = useTranslation();
  // Libellés affichés ; les fiches gardent leur section française.
  // i18n-ignore
  const [lSec, lPrim, lPers] = ["Secondaire", "Primaire", "Personnel"].map(libelleSectionPaie);
  const totGen=totNetSec+totNetPrim+totNetPers;
  const nbEns=salairesMois.length;
  const dataEvol=moisSalaire.map(m=>{
    const ms=salaires.filter(s=>s.mois===m);
    const sec=ms.filter(s=>s.section==="Secondaire").reduce((sum,s)=>sum+calcNet(s),0);
    const prim=ms.filter(s=>s.section==="Primaire").reduce((sum,s)=>sum+getForfaitNet(s),0);
    const pers=ms.filter(s=>s.section==="Personnel").reduce((sum,s)=>sum+getForfaitNet(s),0);
    return {mois:libelleMoisCourt(m),secondaire:sec,primaire:prim,personnel:pers,total:sec+prim+pers};
  });
  return <>
    {/* Cartes récap */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
      <div style={{background:"linear-gradient(135deg,#0A1628,#1d4ed8)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
        <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{t("accounting.sal.payroll")}</div>
        <div style={{fontSize:18,fontWeight:900}}>{(totGen/1e6).toFixed(3)}M</div>
        {/* i18n-ignore */}
        <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF — {moisLabel}</div>
      </div>
      {groupesPaie.secondaire&&<div style={{background:"linear-gradient(135deg,#0A1628,#1a6baa)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
        <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{lSec}</div>
        <div style={{fontSize:18,fontWeight:900}}>{(totNetSec/1e6).toFixed(3)}M</div>
        <div style={{fontSize:10,opacity:.75,marginTop:2}}>{t("accounting.sal.teachersCount",{count:salairesSec.length})}</div>
      </div>}
      {groupesPaie.primaire&&<div style={{background:"linear-gradient(135deg,#00A876,#00C48C)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
        <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{lPrim}</div>
        <div style={{fontSize:18,fontWeight:900}}>{(totNetPrim/1e6).toFixed(3)}M</div>
        <div style={{fontSize:10,opacity:.75,marginTop:2}}>{t("accounting.sal.teachersCount",{count:salairesPrim.length})}</div>
      </div>}
      <div style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
        <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{lPers}</div>
        <div style={{fontSize:18,fontWeight:900}}>{(totNetPers/1e6).toFixed(3)}M</div>
        <div style={{fontSize:10,opacity:.75,marginTop:2}}>{t("accounting.sal.employeesCount",{count:salairesPers.length})}</div>
      </div>
      <div style={{background:"linear-gradient(135deg,#0A1628,#1565c0)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
        <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{t("accounting.sal.totalAgents")}</div>
        <div style={{fontSize:28,fontWeight:900}}>{nbEns}</div>
        <div style={{fontSize:10,opacity:.75,marginTop:2}}>{t("accounting.sal.thisMonth")}</div>
      </div>
      <div style={{background:"linear-gradient(135deg,#b45309,#f59e0b)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
        <div style={{fontSize:11,opacity:.85,marginBottom:4}}>{t("accounting.sal.avgPerAgent")}</div>
        <div style={{fontSize:18,fontWeight:900}}>{nbEns>0?Math.round(totGen/nbEns).toLocaleString(localeCourante()):0}</div>
        {/* i18n-ignore */}
        <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF</div>
      </div>
    </div>
    {/* Barre de répartition */}
    {totGen>0&&<div style={{marginBottom:16,background:"#f0f4f8",borderRadius:10,padding:"12px 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginBottom:6,flexWrap:"wrap",gap:4}}>
        {groupesPaie.secondaire&&<span style={{color:C.blue}}>{t("accounting.sal.share",{group:lSec,pct:totNetSec>0?((totNetSec/totGen)*100).toFixed(1):0})}</span>}
        {groupesPaie.primaire&&<span style={{color:C.green}}>{t("accounting.sal.share",{group:lPrim,pct:totNetPrim>0?((totNetPrim/totGen)*100).toFixed(1):0})}</span>}
        <span style={{color:"#7c3aed"}}>{t("accounting.sal.share",{group:lPers,pct:totNetPers>0?((totNetPers/totGen)*100).toFixed(1):0})}</span>
      </div>
      <div style={{display:"flex",borderRadius:6,overflow:"hidden",height:12}}>
        <div style={{background:C.blue,width:`${totGen>0?(totNetSec/totGen*100):0}%`,transition:"width .4s"}}/>
        <div style={{background:C.green,width:`${totGen>0?(totNetPrim/totGen*100):0}%`,transition:"width .4s"}}/>
        <div style={{background:"#a855f7",flex:1}}/>
      </div>
    </div>}
    {/* Graphique évolution annuelle */}
    {salaires.length>0&&<Card style={{marginBottom:16}}><div style={{padding:"14px 16px"}}>
      <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>{t("accounting.sal.evolution",{year:annee||getAnnee()})}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={dataEvol} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
          <XAxis dataKey="mois" tick={{fontSize:10}}/>
          <YAxis tick={{fontSize:10}} tickFormatter={v=>v===0?"0":`${(v/1e6).toFixed(1)}M`}/>
          <Tooltip formatter={(v,n)=>[fmtN(v)+" GNF",n]}/>
          <Legend wrapperStyle={{fontSize:11}}/>
          {groupesPaie.secondaire&&<Bar dataKey="secondaire" name={lSec} fill={C.blue} radius={[3,3,0,0]}/>}
          {groupesPaie.primaire&&<Bar dataKey="primaire" name={lPrim} fill={C.green} radius={[3,3,0,0]}/>}
          <Bar dataKey="personnel" name={lPers} fill="#a855f7" radius={[3,3,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
    </div></Card>}
  </>;
}
