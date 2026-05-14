import React from "react";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { C, fmt, getMonnaie } from "../../constants";
import { Card, Chargement, Stat, Vide } from "../ui";

export function BilanTab({
  schoolInfo,
  canCreate,
  toggleBlocage,
  recettes,
  depenses,
  cR,
  cD,
  totR,
  totD,
  totVers,
  totNetSec,
  totNetPrim,
  totNetPers,
  impaye,
  pctImpaye,
  salairesMois,
  moisLabel,
  mensualiteOverview,
}) {
  const { t } = useTranslation();
  const blocage = !!schoolInfo.blocageParentImpaye;
  const cur = getMonnaie();

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:16}}>
        <Stat label={t("accounting.revenuesTitle")} value={`${(totR/1e6).toFixed(2)}M`} sub={cur} bg="#eaf4e0"/>
        <Stat label={t("accounting.expensesTitle")} value={`${(totD/1e6).toFixed(2)}M`} sub={cur} bg="#fce8e8"/>
        <Stat label={t("accounting.tabs.donations")} value={`${(totVers/1e6).toFixed(2)}M`} sub={cur} bg="#e6f4ea"/>
        <Stat label={t("accounting.balanceLabel")} value={`${((totR-totD)/1e6).toFixed(2)}M`} sub={cur} bg={(totR-totD)>=0?"#eaf4e0":"#fce8e8"}/>
        <Stat label={t("accounting.totalSalaries")} value={`${((totNetSec+totNetPrim+totNetPers)/1e6).toFixed(3)}M`} sub={`${cur} — ${moisLabel} (${salairesMois.length})`} bg="#fef3e0"/>
        <Stat label={t("accounting.outstanding")} value={`${(impaye/1e6).toFixed(2)}M`} sub={`${cur} — ${pctImpaye}%`} bg="#fce8e8"/>
        <Stat label={t("accounting.totalReceived")} value={`${(mensualiteOverview.totalPercu/1e6).toFixed(2)}M`} sub={`${mensualiteOverview.totalDu>0?(100-Number(pctImpaye)).toFixed(1):0}%`} bg="#eaf4e0"/>
      </div>
      {/* ── Contrôle accès parent ── */}
      <div style={{background:blocage?"#fff0f0":"#f0fdf4",border:`2px solid ${blocage?"#f87171":"#4ade80"}`,borderRadius:14,padding:"18px 20px",marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <span style={{fontSize:34,lineHeight:1}}>{blocage?"🔒":"🔓"}</span>
          <div style={{flex:1,minWidth:180}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontWeight:900,fontSize:14,color:"#1e293b"}}>Portail parents — Notes & Bulletins</span>
              <span style={{
                display:"inline-block",padding:"3px 12px",borderRadius:20,fontWeight:900,fontSize:12,letterSpacing:.5,
                background:blocage?"#b91c1c":"#15803d",color:"#fff",
              }}>{blocage?"🔴 BLOQUÉ":"🟢 OUVERT"}</span>
            </div>
            <div style={{fontSize:12,color:"#6b7280"}}>
              {blocage
                ? "Les parents d'élèves avec mensualités impayées ne peuvent pas consulter ni imprimer les notes et bulletins."
                : "Tous les parents peuvent consulter et imprimer les notes et bulletins."}
            </div>
          </div>
          {canCreate&&(
            <button onClick={toggleBlocage} style={{
              background:blocage?"#15803d":"#b91c1c",color:"#fff",
              border:"none",padding:"10px 22px",borderRadius:10,cursor:"pointer",fontWeight:900,fontSize:13,
              whiteSpace:"nowrap",boxShadow:"0 2px 6px rgba(0,0,0,.15)",
            }}>
              {blocage?"🔓 Débloquer":"🔒 Bloquer"}
            </button>
          )}
        </div>
      </div>
      {(cR||cD)?<Chargement/>:totR===0&&totD===0?<Vide icone="📊" msg="Aucune donnée financière"/>
        :<>
          <Card><div style={{padding:"16px 18px"}}>
            {[{l:"Recettes",v:totR,c:C.green},{l:"Dépenses",v:totD,c:"#b91c1c"}].map(b=>(
              <div key={b.l} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:700,color:b.c}}>{b.l}</span>
                  <span style={{fontSize:12,fontWeight:600}}>{fmt(b.v)}</span>
                </div>
                <div style={{background:"#e8f0e8",borderRadius:6,height:8}}>
                  <div style={{background:b.c,borderRadius:6,height:8,width:`${(b.v/Math.max(totR,totD,1)*100).toFixed(0)}%`}}/>
                </div>
              </div>
            ))}
            <div style={{marginTop:14,padding:"10px 14px",background:(totR-totD)>=0?"#eaf4e0":"#fce8e8",borderRadius:7,display:"flex",justifyContent:"space-between"}}>
              <strong style={{color:(totR-totD)>=0?C.greenDk:"#b91c1c"}}>Solde</strong>
              <strong style={{color:(totR-totD)>=0?C.greenDk:"#b91c1c"}}>{fmt(totR-totD)}</strong>
            </div>
          </div></Card>

          {/* ── Graphiques ── */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginTop:14}}>
            {/* Recettes vs Dépenses par période */}
            <Card><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Recettes vs Dépenses par période</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={["T1","T2","T3"].map(p=>({
                  periode:p,
                  Recettes:recettes.filter(r=>r.periode===p).reduce((s,r)=>s+Number(r.montant||0),0),
                  "Dépenses":depenses.filter(d=>d.periode===p).reduce((s,d)=>s+Number(d.montant||0),0),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="periode" tick={{fontSize:11}}/>
                  <YAxis tick={{fontSize:10}} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/>
                  <Tooltip formatter={v=>fmt(v)}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Bar dataKey="Recettes" fill={C.green} radius={[4,4,0,0]}/>
                  <Bar dataKey="Dépenses" fill="#ef4444" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div></Card>

            {/* Mensualités payées vs impayées */}
            <Card><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Mensualités — état des paiements</p>
              {(()=>{
                const data=[
                  {name:"Payés",value:mensualiteOverview.totalPayes},
                  {name:"Impayés",value:mensualiteOverview.totalImpayes},
                ];
                return <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      <Cell fill={C.green}/><Cell fill="#ef4444"/>
                    </Pie>
                    <Tooltip formatter={v=>`${v} mois`}/>
                  </PieChart>
                </ResponsiveContainer>;
              })()}
            </div></Card>
          </div>

          {/* Évolution mensuelle des recettes */}
          {recettes.length>0&&<Card style={{marginTop:14}}><div style={{padding:"14px 16px"}}>
            <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Évolution des recettes par catégorie</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(()=>{
                const cats=[...new Set(recettes.map(r=>r.categorie))].filter(Boolean);
                return ["T1","T2","T3"].map(p=>{
                  const row={periode:p};
                  cats.forEach(c=>row[c]=recettes.filter(r=>r.periode===p&&r.categorie===c).reduce((s,r)=>s+Number(r.montant||0),0));
                  return row;
                });
              })()} >
                <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                <XAxis dataKey="periode" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>`${(v/1e6).toFixed(1)}M`}/>
                <Tooltip formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                {[...new Set(recettes.map(r=>r.categorie))].filter(Boolean).map((cat,i)=>(
                  <Bar key={cat} dataKey={cat} stackId="a" fill={["#0A1628","#00C48C","#f59e0b","#00A876","#ef4444","#06b6d4"][i%6]} radius={i===0?[0,0,4,4]:[0,0,0,0]}/>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div></Card>}
        </>}
    </div>
  );
}
