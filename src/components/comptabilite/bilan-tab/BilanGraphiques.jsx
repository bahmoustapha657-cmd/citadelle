import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { C, fmt } from "../../../constants";
import { Card } from "../../ui";

// Bloc graphique du bilan : barres recettes/dépenses, barres par période,
// camembert des mensualités payées/impayées et évolution par catégorie.
export function BilanGraphiques({ recettes, depenses, totR, totD, mensualiteOverview, periodes }) {
  return (
    <>
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
            <BarChart data={periodes.map(p=>({
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
            return periodes.map(p=>{
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
    </>
  );
}
