import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C } from "../constants";
import { Card, Chargement, Vide } from "./ui";

// ══════════════════════════════════════════════════════════════
//  Journal des actions. Les entrées de suppression embarquent le
//  contenu intégral du document supprimé (champ `suppression`) :
//  cliquer sur l'entrée déplie le détail complet.
// ══════════════════════════════════════════════════════════════

// Rend une valeur de champ lisible (objets imbriqués → JSON court).
function valeurLisible(valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return "—";
  if (typeof valeur === "object") {
    const json = JSON.stringify(valeur);
    return json.length > 220 ? json.slice(0, 220) + "…" : json;
  }
  return String(valeur);
}

function DetailSuppression({ suppression }) {
  const donnees = suppression?.donnees || {};
  const cles = Object.keys(donnees).sort();
  return (
    <div style={{marginTop:10,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px"}}>
      <div style={{fontSize:11,fontWeight:800,color:"#b91c1c",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
        🗑 Document supprimé — {suppression.collection} · id {suppression.docId}
      </div>
      {cles.length === 0
        ? <div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>Contenu non capturé (document inconnu au moment de la suppression).</div>
        : (
          <div style={{display:"grid",gridTemplateColumns:"minmax(110px,max-content) 1fr",gap:"4px 14px"}}>
            {cles.map((cle) => (
              <React.Fragment key={cle}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b"}}>{cle}</div>
                <div style={{fontSize:12,color:"#1f2937",wordBreak:"break-word"}}>{valeurLisible(donnees[cle])}</div>
              </React.Fragment>
            ))}
          </div>
        )}
    </div>
  );
}

function HistoriqueActions() {
  useContext(SchoolContext);
  const {items:historique, chargement} = useFirestore("historique");
  const [filtre, setFiltre] = useState("");
  const [ouvert, setOuvert] = useState(null); // _id de l'entrée dépliée

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
    "Suppression": "🗑", "Salaires": "📋", "Compte": "👤", "EDT": "📅", "Connexion": "🔑",
    "Mensualité": "💰", "Frais": "💰",
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
          <p style={{margin:"3px 0 0",fontSize:12,color:"#6b7280"}}>Journal des opérations enregistrées dans le système — cliquez sur une suppression pour voir le détail</p>
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
            {filtres.slice(0,100).map((h,i)=>{
              const id = h._id||String(i);
              const detaillable = !!h.suppression;
              const estOuvert = ouvert === id;
              return (
                <div key={id}
                  onClick={detaillable ? ()=>setOuvert(estOuvert?null:id) : undefined}
                  style={{padding:"12px 18px",borderBottom:"1px solid #f1f5f9",cursor:detaillable?"pointer":"default",
                    background:estOuvert?"#fef2f2":"transparent"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                    <div style={{fontSize:20,flexShrink:0,marginTop:1}}>{getIcon(h.action||"")}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:800,color:h.suppression?"#b91c1c":C.blue}}>
                        {h.action||"Action"}
                        {detaillable&&<span style={{marginLeft:8,fontSize:11,fontWeight:700,color:"#9ca3af"}}>{estOuvert?"▲ replier":"▼ détail"}</span>}
                      </div>
                      {h.details&&<div style={{fontSize:12,color:"#6b7280",marginTop:2}}>{h.details}</div>}
                      {h.auteur&&<div style={{fontSize:11,color:"#9ca3af",marginTop:2}}>Par : {h.auteur}</div>}
                    </div>
                    <div style={{fontSize:11,color:"#9ca3af",flexShrink:0,marginTop:2,textAlign:"right"}}>{fmtDate(h.date)}</div>
                  </div>
                  {estOuvert&&detaillable&&<DetailSuppression suppression={h.suppression}/>}
                </div>
              );
            })}
            {filtres.length > 100 && <div style={{padding:"10px 18px",fontSize:11,color:"#9ca3af",textAlign:"center"}}>+{filtres.length-100} entrées supplémentaires...</div>}
          </div>
        </Card>
      )}
    </div>
  );
}

export { HistoriqueActions };
