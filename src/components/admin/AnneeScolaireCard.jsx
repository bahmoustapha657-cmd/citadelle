import React from "react";
import { C, TOUTES_ANNEES } from "../../constants";
import { Btn, Card } from "../ui";

export function AnneeScolaireCard({ annee, setAnnee }) {
  return (
    <Card style={{marginBottom:20,padding:"16px 20px"}}>
      <p style={{margin:"0 0 12px",fontWeight:800,fontSize:14,color:C.blueDark}}>📅 Année scolaire</p>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <select value={annee} onChange={e=>setAnnee(e.target.value)}
          style={{border:"2px solid "+C.blue,borderRadius:8,padding:"8px 14px",fontSize:15,fontWeight:800,color:C.blueDark,background:"#fff"}}>
          {TOUTES_ANNEES.map(a=><option key={a}>{a}</option>)}
        </select>
        <Btn v="success" onClick={()=>{
          const idx=TOUTES_ANNEES.indexOf(annee);
          if(idx<TOUTES_ANNEES.length-1)setAnnee(TOUTES_ANNEES[idx+1]);
        }}>▶ Année suivante</Btn>
        <Btn v="ghost" onClick={()=>{
          const idx=TOUTES_ANNEES.indexOf(annee);
          if(idx>0)setAnnee(TOUTES_ANNEES[idx-1]);
        }}>◀ Année précédente</Btn>
        <span style={{fontSize:13,color:C.green,fontWeight:700}}>Année active : <strong>{annee}</strong></span>
      </div>
      <p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0"}}>Attention : changer l'année affecte tous les modules de l'application.</p>
    </Card>
  );
}
