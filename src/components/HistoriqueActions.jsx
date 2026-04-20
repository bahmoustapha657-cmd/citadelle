import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, fmt } from "../constants";
import { Card, Chargement, Stat, Vide } from "./ui";

// ══════════════════════════════════════════════════════════════
function HistoriqueActions() {
  const {schoolInfo} = useContext(SchoolContext);
  const {items:historique, chargement} = useFirestore("historique");
  const [filtre, setFiltre] = useState("");

  const sorted = [...historique].sort((a,b)=>(b.date||0)-(a.date||0));
  const filtres = sorted.filter(h=>
    !filtre ||
    (h.action||"").toLowerCase().includes(filtre.toLowerCase()) ||
    (h.details||"").toLowerCase().includes(filtre.toLowerCase())
  );

  const fmtDate = (ts) => {
    if(!ts) return "—";
    const d = new Date(ts);
    return d.toLocaleDateString("fr-FR") + " à " + d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
  };

  const ICONS = {
    "Salaires": "📋", "Compte": "👤", "EDT": "📅", "Connexion": "🔑",
  };
  const getIcon = (action) => {
    for(const [key,icon] of Object.entries(ICONS)) if(action.includes(key)) return icon;
    return "📝";
  };

  return (
    <div style={{padding:"22px 26px",maxWidth:900}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <h1 style={{margin:0,fontSize:18,fontWeight:900,color:C.blue}}>Historique des actions</h1>
          <p style={{margin:"3px 0 0",fontSize:12,color:"#6b7280"}}>Journal des opérations enregistrées dans le système</p>
        </div>
        <input value={filtre} onChange={e=>setFiltre(e.target.value)}
          placeholder="Rechercher une action..."
          style={{border:"1px solid #b0c4d8",borderRadius:8,padding:"7px 12px",fontSize:12,minWidth:200,color:C.blue}}/>
      </div>
      {chargement ? <Chargement type="liste" rows={6}/> : filtres.length===0 ? (
        <Vide icone="📋" msg={filtre?"Aucun résultat":"Aucune action enregistrée — les actions importantes apparaîtront ici."}/>
      ) : (
        <Card>
          <div style={{padding:"0"}}>
            {filtres.slice(0,100).map((h,i)=>(
              <div key={h._id||i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 18px",borderBottom:"1px solid #f1f5f9"}}>
                <div style={{fontSize:20,flexShrink:0,marginTop:1}}>{getIcon(h.action||"")}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:C.blue}}>{h.action||"Action"}</div>
                  {h.details&&<div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{h.details}</div>}
                  {h.auteur&&<div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Par : {h.auteur}</div>}
                </div>
                <div style={{fontSize:11,color:"#9ca3af",flexShrink:0,marginTop:2,textAlign:"right"}}>{fmtDate(h.date)}</div>
              </div>
            ))}
            {filtres.length > 100 && <div style={{padding:"10px 18px",fontSize:11,color:"#9ca3af",textAlign:"center"}}>+{filtres.length-100} entrées supplémentaires...</div>}
          </div>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  TABLEAU DE BORD DIRECTION
// ══════════════════════════════════════════════════════════════

export { HistoriqueActions };
