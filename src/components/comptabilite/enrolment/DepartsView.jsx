import React from "react";
import { C } from "../../../constants";
import { Badge, Btn, Card, Stat, THead, TR, TD, Vide } from "../../ui";

const MOTIFS_DEPART = ["Transféré","Exclu","Abandonné","Décédé","Inactif"];

export function DepartsView({ elevesEnrol, canEdit, modEnrol, toast }) {
  const partis = elevesEnrol.filter(e=>MOTIFS_DEPART.includes(e.statut));
  const actifs = elevesEnrol.filter(e=>e.statut==="Actif");
  const total  = elevesEnrol.length;
  const tauxRetention = total>0 ? ((actifs.length/total)*100).toFixed(1) : "100";
  const parMotif = MOTIFS_DEPART.map(m=>({motif:m, count:partis.filter(e=>e.statut===m).length})).filter(x=>x.count>0);
  const parClasse = [...new Set(partis.map(e=>e.classe))].filter(Boolean).map(cl=>({
    classe:cl, count:partis.filter(e=>e.classe===cl).length
  })).sort((a,b)=>b.count-a.count);
  return (<>
    {/* ── Stats cards ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
      <Stat label="Élèves actifs" value={actifs.length} bg="#dcfce7" sub={`${tauxRetention}% de rétention`}/>
      <Stat label="Total départs" value={partis.length} bg="#fee2e2" sub="cette année scolaire"/>
      {parMotif.map(x=>(
        <Stat key={x.motif} label={x.motif} value={x.count} bg={
          x.motif==="Transféré"?"#dbeafe":x.motif==="Exclu"?"#fef9c3":x.motif==="Abandonné"?"#ffe4e6":x.motif==="Décédé"?"#f3f4f6":"#f0fdf4"
        }/>
      ))}
    </div>
    {parClasse.length>0&&<Card style={{marginBottom:14}}>
      <div style={{padding:"12px 16px"}}>
        <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>Départs par classe</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {parClasse.map(x=>(
            <span key={x.classe} style={{background:"#fee2e2",color:"#b91c1c",fontWeight:800,fontSize:12,padding:"4px 12px",borderRadius:20}}>
              {x.classe} : {x.count}
            </span>
          ))}
        </div>
      </div>
    </Card>}
    {/* ── Liste des partis ── */}
    {partis.length===0?<Vide icone="✅" msg="Aucun départ enregistré pour cette section"/>
    :<div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:700}}>
        <THead cols={["Matricule","Nom & Prénom","Classe","Motif","Date départ","Destination / Détail","Actions"]}/>
        <tbody>{partis.map(e=>(
          <TR key={e._id}>
            <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
            <TD bold>{e.nom} {e.prenom}</TD>
            <TD><Badge color="blue">{e.classe}</Badge></TD>
            <TD><Badge color={e.statut==="Exclu"?"red":e.statut==="Décédé"?"gray":"amber"}>{e.statut}</Badge></TD>
            <TD>{e.dateDepart||"—"}</TD>
            <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.destinationDepart||e.motifDepart||"—"}</span></TD>
            {canEdit&&<TD>
              <Btn sm v="vert" onClick={async()=>{
                if(confirm(`Réintégrer ${e.nom} ${e.prenom} comme élève Actif ?`)){
                  await modEnrol({_id:e._id,statut:"Actif",dateDepart:null,motifDepart:null,destinationDepart:null});
                  toast("Élève réintégré","success");
                }
              }}>↩ Réintégrer</Btn>
            </TD>}
          </TR>
        ))}</tbody>
      </table>
    </div>}
  </>);
}
