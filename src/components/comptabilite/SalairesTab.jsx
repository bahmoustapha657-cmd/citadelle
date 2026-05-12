import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { C, CLASSES_PRIMAIRE, fmtN, getAnnee } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";
import { getFifthWeekDays } from "../../salary-utils";

export function SalairesTab({
  // sous-onglet
  sousTabSal,
  setSousTabSal,
  // sélection mois
  moisSel,
  setMoisSel,
  moisSalaire,
  moisLabel,
  moisModale,
  annee,
  // prime défaut
  primeDefaut,
  setPrimeDefaut,
  // form / modal
  form,
  setForm,
  modal,
  setModal,
  // permissions
  canCreate,
  canEdit,
  readOnly,
  // données salaires
  salaires,
  cS,
  ajS,
  modS,
  supS,
  salairesMois,
  salairesSec,
  salairesPrim,
  salairesPers,
  totNetSec,
  totNetPrim,
  totNetPers,
  // données bons
  bonsMois,
  ajBon,
  modBon,
  supBon,
  // filtres primaire
  filtrePrimNom,
  setFiltrePrimNom,
  filtrePrimClasse,
  setFiltrePrimClasse,
  // helpers de calcul
  calcExecute,
  calcMontant,
  calcNet,
  calcNetF,
  // actions
  autoGenererSalaires,
  appliquerBons,
  imprimerSalaires,
  enreg,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      {/* Barre de navigation interne */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[{id:"etats",label:"États de salaires"},{id:"bons",label:`Bons (${bonsMois.length})`}].map(t=>(
          <button key={t.id} onClick={()=>setSousTabSal(t.id)} style={{
            padding:"7px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
            background:sousTabSal===t.id?C.blueDark:"#e0ebf8",
            color:sousTabSal===t.id?"#fff":C.blueDark,
          }}>{t.label}</button>
        ))}
        <div style={{flex:1}}/>
        <select value={moisSel} onChange={e=>setMoisSel(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",color:C.blueDark,fontWeight:700}}>
          <option value="__TOUS__">Tous les mois (prévision)</option>
          {moisSalaire.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        {sousTabSal==="etats"&&<>
          {canCreate&&<label title="Appliquée uniquement aux enseignants sans prime définie sur leur fiche" style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:C.blueDark,background:"#f0f7ff",border:"1px solid #b0c4d8",borderRadius:7,padding:"4px 10px",cursor:"help"}}>
            Prime/h par défaut
            <input type="number" min="0" value={primeDefaut||""} placeholder="0"
              onChange={e=>setPrimeDefaut(Number(e.target.value))}
              style={{width:80,border:"none",background:"transparent",fontSize:13,fontWeight:700,color:C.blueDark,outline:"none"}}/>
            GNF
          </label>}
          {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires()}>⚡ Auto-générer</Btn>}
          {canCreate&&<Btn v="amber" onClick={()=>autoGenererSalaires({resync:true})} title="Recalcule V/H et prime horaire des lignes existantes à partir de la fiche enseignant et de l'EDT actuels (bons et révisions préservés)">🔄 Rafraîchir</Btn>}
          {canCreate&&bonsMois.length>0&&<Btn v="amber" onClick={appliquerBons}>✔ Appliquer les bons</Btn>}
          {canCreate&&<Btn onClick={()=>{setForm({section:"Secondaire",mois:moisModale,nonExecute:0,cinqSem:0,bon:0,revision:0});setModal("add_s");}}>+ Ajouter</Btn>}
          <Btn v="vert" onClick={imprimerSalaires}>🖨️ Imprimer</Btn>
        </>}
        {(()=>{const j5=getFifthWeekDays(moisSel);return j5.length>0&&(
          <div style={{width:"100%",marginTop:6,background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:8,padding:"7px 14px",fontSize:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:15}}>📅</span>
            <strong style={{color:"#92400e"}}>{moisSel} — 5ème semaine :</strong>
            {j5.map(j=><span key={j} style={{background:"#f59e0b",color:"#fff",fontWeight:700,padding:"2px 9px",borderRadius:10,fontSize:11}}>{j}</span>)}
            <span style={{color:"#92400e",fontSize:11}}>→ Les enseignants qui ont cours ces jours ont des heures supplémentaires. Cliquez sur ⚡ Auto-générer pour les calculer automatiquement.</span>
          </div>
        );})()}
        {sousTabSal==="bons"&&canCreate&&<Btn onClick={()=>{setForm({mois:moisModale,section:"Secondaire"});setModal("add_b");}}>+ Nouveau bon</Btn>}
      </div>

      {/* ── SOUS-ONGLET BONS ── */}
      {sousTabSal==="bons"&&<>
        {bonsMois.length===0
          ?<Vide icone="📋" msg={`Aucun bon enregistré pour ${moisLabel}`}/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Enseignant","Section","Mois","Montant (GNF)","Motif",canEdit?"Actions":""]}/>
            <tbody>{bonsMois.map(b=><TR key={b._id}>
              <TD bold>{b.nom}</TD>
              <TD><Badge color={b.section==="Primaire"?"vert":"blue"}>{b.section}</Badge></TD>
              <TD>{b.mois}</TD>
              <TD center style={{color:"#b91c1c",fontWeight:700}}>{fmtN(b.montant||0)}</TD>
              <TD>{b.motif||"—"}</TD>
              {canEdit&&<TD center>
                <Btn sm v="ghost" onClick={()=>{setForm({...b});setModal("edit_b");}}>✏️</Btn>
                <Btn sm v="red" onClick={()=>confirm("Supprimer ce bon ?")&&supBon(b._id)}>🗑</Btn>
              </TD>}
            </TR>)}
            <tr style={{background:"#fce8e8",fontWeight:800}}>
              <td colSpan={3} style={{padding:"8px 12px",textAlign:"right",color:"#9b2020"}}>TOTAL BONS — {moisLabel}</td>
              <td style={{padding:"8px 12px",textAlign:"center",color:"#9b2020",fontSize:14}}>{fmtN(bonsMois.reduce((s,b)=>s+Number(b.montant||0),0))}</td>
              <td colSpan={2}></td>
            </tr>
            </tbody>
          </table></Card>
        }
        <div style={{marginTop:12,padding:"12px 16px",background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,fontSize:13,color:"#92400e"}}>
          <strong>Comment ça marche :</strong> Enregistrez ici les bons de chaque enseignant pour ce mois.
          Ensuite, dans <em>États de salaires</em>, cliquez sur <strong>✔ Appliquer les bons</strong> pour reporter automatiquement les montants dans la colonne "Bon" de chaque enseignant.
        </div>
      </>}

      {/* ── SOUS-ONGLET ÉTATS ── */}
      {sousTabSal==="etats"&&<>

      {/* ── BILAN SALAIRES ── */}
      {!cS&&(()=>{
        const totGen=totNetSec+totNetPrim+totNetPers;
        const nbEns=salairesMois.length;
        const dataEvol=moisSalaire.map(m=>{
          const ms=salaires.filter(s=>s.mois===m);
          const sec=ms.filter(s=>s.section==="Secondaire").reduce((sum,s)=>sum+calcNet(s),0);
          const prim=ms.filter(s=>s.section==="Primaire").reduce((sum,s)=>sum+Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0),0);
          const pers=ms.filter(s=>s.section==="Personnel").reduce((sum,s)=>sum+Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0),0);
          return {mois:m.slice(0,4),Secondaire:sec,Primaire:prim,Personnel:pers,Total:sec+prim+pers};
        });
        return <>
          {/* Cartes récap */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
            <div style={{background:"linear-gradient(135deg,#0A1628,#1d4ed8)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Masse salariale</div>
              <div style={{fontSize:18,fontWeight:900}}>{(totGen/1e6).toFixed(3)}M</div>
              <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF — {moisLabel}</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#0A1628,#1a6baa)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Secondaire</div>
              <div style={{fontSize:18,fontWeight:900}}>{(totNetSec/1e6).toFixed(3)}M</div>
              <div style={{fontSize:10,opacity:.75,marginTop:2}}>{salairesSec.length} enseignant(s)</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#00A876,#00C48C)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Primaire</div>
              <div style={{fontSize:18,fontWeight:900}}>{(totNetPrim/1e6).toFixed(3)}M</div>
              <div style={{fontSize:10,opacity:.75,marginTop:2}}>{salairesPrim.length} enseignant(s)</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#7c3aed,#a855f7)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Personnel</div>
              <div style={{fontSize:18,fontWeight:900}}>{(totNetPers/1e6).toFixed(3)}M</div>
              <div style={{fontSize:10,opacity:.75,marginTop:2}}>{salairesPers.length} employé(s)</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#0A1628,#1565c0)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Total agents</div>
              <div style={{fontSize:28,fontWeight:900}}>{nbEns}</div>
              <div style={{fontSize:10,opacity:.75,marginTop:2}}>ce mois</div>
            </div>
            <div style={{background:"linear-gradient(135deg,#b45309,#f59e0b)",borderRadius:10,padding:"14px 16px",color:"#fff",textAlign:"center"}}>
              <div style={{fontSize:11,opacity:.85,marginBottom:4}}>Moy. par agent</div>
              <div style={{fontSize:18,fontWeight:900}}>{nbEns>0?Math.round(totGen/nbEns).toLocaleString("fr-FR"):0}</div>
              <div style={{fontSize:10,opacity:.75,marginTop:2}}>GNF</div>
            </div>
          </div>
          {/* Barre de répartition */}
          {totGen>0&&<div style={{marginBottom:16,background:"#f0f4f8",borderRadius:10,padding:"12px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginBottom:6,flexWrap:"wrap",gap:4}}>
              <span style={{color:C.blue}}>Secondaire : {totNetSec>0?((totNetSec/totGen)*100).toFixed(1):0}%</span>
              <span style={{color:C.green}}>Primaire : {totNetPrim>0?((totNetPrim/totGen)*100).toFixed(1):0}%</span>
              <span style={{color:"#7c3aed"}}>Personnel : {totNetPers>0?((totNetPers/totGen)*100).toFixed(1):0}%</span>
            </div>
            <div style={{display:"flex",borderRadius:6,overflow:"hidden",height:12}}>
              <div style={{background:C.blue,width:`${totGen>0?(totNetSec/totGen*100):0}%`,transition:"width .4s"}}/>
              <div style={{background:C.green,width:`${totGen>0?(totNetPrim/totGen*100):0}%`,transition:"width .4s"}}/>
              <div style={{background:"#a855f7",flex:1}}/>
            </div>
          </div>}
          {/* Graphique évolution annuelle */}
          {salaires.length>0&&<Card style={{marginBottom:16}}><div style={{padding:"14px 16px"}}>
            <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Évolution de la masse salariale — Année {annee||getAnnee()}</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dataEvol} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                <XAxis dataKey="mois" tick={{fontSize:10}}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v=>v===0?"0":`${(v/1e6).toFixed(1)}M`}/>
                <Tooltip formatter={(v,n)=>[fmtN(v)+" GNF",n]}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="Secondaire" fill={C.blue} radius={[3,3,0,0]}/>
                <Bar dataKey="Primaire" fill={C.green} radius={[3,3,0,0]}/>
                <Bar dataKey="Personnel" fill="#a855f7" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div></Card>}
        </>;
      })()}

      {cS?<Chargement/>:<>
        {moisSel==="__TOUS__"&&<div style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#92400e"}}>
          <strong>📊 Mode prévision annuelle</strong> — Sélectionnez un mois précis pour consulter ou modifier ses salaires.
          Cliquez sur <strong>⚡ Auto-générer</strong> pour remplir d'un coup les {moisSalaire.length} mois de l'année scolaire.
        </div>}

        {/* Section Secondaire */}
        <div style={{background:C.blue,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13}}>
          SECTION SECONDAIRE — {moisLabel} {annee||getAnnee()}
        </div>
        <div style={{overflowX:"auto",marginBottom:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
            <thead>
              <tr style={{background:"#e0ebf8"}}>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>N°</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Prénoms et Nom</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Matière</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Niveau</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>V.H.<br/>Hebdo</th>
                <th colSpan={4} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>V.H. Mensuel</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>Prime<br/>Horaire</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>Montant</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>Bon</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center",background:"#fef3e0"}}>Révision</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center",background:"#eaf4e0"}}>Net à<br/>Payer</th>
                <th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Obs.</th>
                {canEdit&&<th rowSpan={2} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8"}}>Act.</th>}
              </tr>
              <tr style={{background:"#e0ebf8"}}>
                {["Prévu","5è Sem","Non Exé.","Exécuté"].map(h=><th key={h} style={{padding:"5px 8px",fontSize:10,fontWeight:700,color:C.blueDark,border:"1px solid #b0c4d8",textAlign:"center"}}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {salairesSec.length===0?
                <tr><td colSpan={canEdit?15:14} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>Aucun enseignant secondaire pour ce mois</td></tr>
                :salairesSec.map((s,i)=>(
                  <tr key={s._id} style={{borderBottom:"1px solid #e8f0e8",background:i%2===0?"#fff":"#f9fbf9"}}>
                    <td style={{padding:"7px 10px",textAlign:"center",fontSize:12,border:"1px solid #e8f0e8"}}>{i+1}</td>
                    <td style={{padding:"7px 10px",fontWeight:700,fontSize:12,color:C.blueDark,border:"1px solid #e8f0e8"}}>{s.nom}</td>
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
              ))}
              <tr style={{background:"#e0ebf8",fontWeight:800}}>
                <td colSpan={13} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark,border:"1px solid #b0c4d8"}}>TOTAL NET SECONDAIRE</td>
                <td style={{padding:"8px 12px",textAlign:"right",color:C.greenDk,fontSize:14,border:"1px solid #b0c4d8"}}>{fmtN(totNetSec)}</td>
                <td colSpan={readOnly?1:2} style={{border:"1px solid #b0c4d8"}}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section Primaire */}
        <div style={{background:C.green,color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{flex:1}}>SECTION PRIMAIRE — {moisLabel} {annee||getAnnee()}</span>
          <input
            placeholder="🔍 Recherche par nom..."
            value={filtrePrimNom} onChange={e=>setFiltrePrimNom(e.target.value)}
            style={{border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#0A1628",width:160,outline:"none"}}/>
          <select value={filtrePrimClasse} onChange={e=>setFiltrePrimClasse(e.target.value)}
            style={{border:"none",borderRadius:6,padding:"4px 8px",fontSize:12,color:"#0A1628",background:"#fff"}}>
            <option value="all">Toutes les classes</option>
            {CLASSES_PRIMAIRE.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{overflowX:"auto",marginBottom:8}}>
          {(()=>{
          const salairesPrimFiltres = salairesPrim
            .filter(s=>!filtrePrimNom||(s.nom||"").toLowerCase().includes(filtrePrimNom.toLowerCase()))
            .filter(s=>filtrePrimClasse==="all"||(s.niveau||"")===filtrePrimClasse);
          return <table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["N°","Prénoms et Nom","Classe","Bon","Révision","Net à Payer","Observation",canEdit?"Actions":""]}/>
            <tbody>
              {salairesPrimFiltres.length===0?
                <tr><td colSpan={canEdit?8:7} style={{padding:"20px",textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>{salairesPrim.length===0?"Aucun enseignant primaire pour ce mois":"Aucun résultat pour ce filtre"}</td></tr>
                :salairesPrimFiltres.map((s,i)=>(
                  <TR key={s._id}>
                    <TD center>{i+1}</TD>
                    <TD bold>{s.nom}</TD>
                    <TD>{s.niveau}</TD>
                    <TD center style={{color:"#b91c1c"}}>{fmtN(s.bon||0)}</TD>
                    <TD center style={{background:"#fffbeb"}}>
                      {canEdit
                        ?<input type="number" value={s.revision||0} onChange={e=>modS({...s,revision:Number(e.target.value)})}
                          style={{width:80,border:"1px solid #fbbf24",borderRadius:5,padding:"3px 5px",fontSize:11,textAlign:"right"}}/>
                        :<span style={{fontSize:12}}>{fmtN(s.revision||0)}</span>}
                    </TD>
                    <TD center style={{fontWeight:800,color:C.greenDk,background:"#eaf4e0"}}>{fmtN(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0))}</TD>
                    <TD>{s.observation}</TD>
                    {canEdit&&<TD><div style={{display:"flex",gap:4}}>
                      <Btn sm v="ghost" onClick={()=>{setForm({...s});setModal("edit_s");}}>✏️</Btn>
                      <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supS(s._id);}}>×</Btn>
                    </div></TD>}
                  </TR>
              ))}
              <tr style={{background:"#e0ebf8",fontWeight:800}}>
                <td colSpan={5} style={{padding:"8px 12px",textAlign:"right",color:C.blueDark}}>
                  TOTAL NET PRIMAIRE {filtrePrimClasse!=="all"||filtrePrimNom?`(filtre : ${salairesPrimFiltres.length}/${salairesPrim.length})` : ""}
                </td>
                <td style={{padding:"8px 12px",textAlign:"center",color:C.greenDk,fontSize:14}}>
                  {fmtN(salairesPrimFiltres.reduce((s,e)=>s+Number(e.montantForfait||0)-Number(e.bon||0)+Number(e.revision||0),0))}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>;
          })()}
        </div>

        {/* Section Personnel */}
        <div style={{background:"#7c3aed",color:"#fff",padding:"8px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:10}}>
          <span style={{flex:1}}>SECTION PERSONNEL — {moisLabel} {annee||getAnnee()}</span>
        </div>
        <div style={{overflowX:"auto",marginBottom:8}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
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
      </>}

      </>}

      {/* MODAL AJOUT/MODIF SALAIRE */}
      {(modal==="add_s"&&canCreate||(modal==="edit_s"&&canEdit))&&<Modale large titre={modal==="add_s"?"Nouveau salaire":"Modifier le salaire"} fermer={()=>setModal(null)}>
        <div style={{marginBottom:14}}>
          <Selec label="Section" value={form.section||"Secondaire"} onChange={chg("section")}>
            <option>Secondaire</option><option>Primaire</option><option>Personnel</option>
          </Selec>
        </div>
        <Selec label="Mois" value={form.mois||moisModale} onChange={chg("mois")}>
          {moisSalaire.map(m=><option key={m}>{m}</option>)}
        </Selec>
        <div style={{height:12}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Prénoms et Nom" value={form.nom||""} onChange={chg("nom")}/></div>
          {form.section==="Secondaire"?<>
            <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
            <Input label="Niveau" value={form.niveau||""} onChange={chg("niveau")}/>
            <Input label="V.H. Hebdomadaire" type="number" value={form.vhHebdo||""} onChange={e=>{const v=Number(e.target.value);setForm(p=>({...p,vhHebdo:v,vhPrevu:v*4}));}}/>
            <Input label="V.H. Mensuel Prévu" type="number" value={form.vhPrevu||""} onChange={chg("vhPrevu")}/>
            <Input label="5ème Semaine" type="number" value={form.cinqSem||0} onChange={chg("cinqSem")}/>
            <Input label="Non Exécuté" type="number" value={form.nonExecute||0} onChange={chg("nonExecute")}/>
            <Input label="Prime Horaire (GNF)" type="number" value={form.primeHoraire||""} onChange={chg("primeHoraire")}/>
            <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
            <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
          </>:form.section==="Personnel"?<>
            <Input label="Poste" value={form.poste||""} onChange={chg("poste")} placeholder="Ex : Gardien, Secrétaire…"/>
            <Selec label="Catégorie" value={form.categorie||""} onChange={chg("categorie")}>
              <option value="">— Catégorie —</option>
              {["Administration","Surveillance","Entretien","Cuisine","Sécurité","Divers"].map(c=><option key={c}>{c}</option>)}
            </Selec>
            <Input label="Salaire de base (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
            <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
            <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
          </>:<>
            <Input label="Classe" value={form.niveau||""} onChange={chg("niveau")}/>
            <Input label="Montant Forfaitaire (GNF)" type="number" value={form.montantForfait||""} onChange={chg("montantForfait")}/>
            <Input label="Bon (GNF)" type="number" value={form.bon||0} onChange={chg("bon")}/>
            <Input label="Révision (GNF)" type="number" value={form.revision||0} onChange={chg("revision")}/>
          </>}
          <div style={{gridColumn:"1/-1"}}><Input label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
        </div>
        {form.section==="Secondaire"&&<div style={{marginTop:12,padding:"10px 14px",background:"#e0ebf8",borderRadius:8,fontSize:13}}>
          <strong>Aperçu :</strong> Exécuté = {calcExecute(form)} h &nbsp;|&nbsp;
          Montant = {fmtN(calcMontant(form))} GNF &nbsp;|&nbsp;
          Bon = -{fmtN(form.bon||0)} &nbsp;|&nbsp;
          Révision = +{fmtN(form.revision||0)} &nbsp;|&nbsp;
          <strong style={{color:C.greenDk}}>Net = {fmtN(calcNet(form))} GNF</strong>
        </div>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>enreg(ajS,modS,{vhHebdo:Number(form.vhHebdo||0),vhPrevu:Number(form.vhPrevu||0),cinqSem:Number(form.cinqSem||0),nonExecute:Number(form.nonExecute||0),primeHoraire:Number(form.primeHoraire||0),bon:Number(form.bon||0),revision:Number(form.revision||0),montantForfait:Number(form.montantForfait||0),montantBrut:null,primesVariables:false})}>Enregistrer</Btn>
        </div>
      </Modale>}

      {/* MODAL AJOUT/MODIF BON */}
      {(modal==="add_b"&&canCreate||(modal==="edit_b"&&canEdit))&&(()=>{
        const moisBon = form.mois||moisModale;
        const secBon = form.section||"Secondaire";
        const ensDisponibles = salaires
          .filter(s=>s.mois===moisBon && s.section===secBon)
          .map(s=>s.nom||"")
          .filter(Boolean)
          .sort();
        return <Modale titre={modal==="add_b"?"Nouveau bon":"Modifier le bon"} fermer={()=>setModal(null)}>
          <Selec label="Mois" value={moisBon} onChange={chg("mois")}>
            {moisSalaire.map(m=><option key={m}>{m}</option>)}
          </Selec>
          <div style={{height:10}}/>
          <Selec label="Section" value={secBon} onChange={e=>{chg("section")(e);setForm(p=>({...p,nom:""}));}}>
            <option>Secondaire</option><option>Primaire</option><option>Personnel</option>
          </Selec>
          <div style={{height:10}}/>
          <Selec label="Enseignant" value={form.nom||""} onChange={chg("nom")}>
            <option value="">— Sélectionner un enseignant —</option>
            {ensDisponibles.map(n=><option key={n} value={n}>{n}</option>)}
            {ensDisponibles.length===0&&<option disabled>Aucun enseignant pour ce mois/section</option>}
          </Selec>
          {ensDisponibles.length===0&&<div style={{fontSize:11,color:"#b45309",marginTop:4}}>
            Générez d'abord les salaires pour ce mois avant d'ajouter des bons.
          </div>}
          <div style={{height:10}}/>
          <Input label="Montant du bon (GNF)" type="number" value={form.montant||""} onChange={chg("montant")} placeholder="Ex : 50000"/>
          <div style={{height:10}}/>
          <Input label="Motif" value={form.motif||""} onChange={chg("motif")} placeholder="Ex : Retard, Absence injustifiée…"/>
          <div style={{marginTop:12,padding:"10px 14px",background:"#fce8e8",borderRadius:8,fontSize:12,color:"#9b2020"}}>
            Le bon sera déduit du salaire net de l'enseignant lors de l'application.
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>enreg(ajBon,modBon,{montant:Number(form.montant||0)})}>Enregistrer</Btn>
          </div>
        </Modale>;
      })()}
    </div>
  );
}
