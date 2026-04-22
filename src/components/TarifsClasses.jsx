import React, { useState } from "react";
import { C, getClassesForSection, getSectionLabel } from "../constants";
import { Btn } from "./ui";

function TarifsClasses({saveTarif, getTarif, getTarifIns, getTarifReinsc, canEdit}) {
  const [ouvert, setOuvert] = useState(false);
  // editing: { "Classe X": {mens, ins, reinsc} }
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(false);

  const handleChange = (classe, champ, val) =>
    setEditing(p=>({...p,[classe]:{...(p[classe]||{}), [champ]:val}}));

  const sauvegarderTout = async () => {
    setSaving(true);
    try {
      for(const [classe, vals] of Object.entries(editing)){
        await saveTarif(
          classe,
          vals.mens!==undefined ? vals.mens : String(getTarif(classe)),
          vals.ins!==undefined  ? vals.ins  : String(getTarifIns(classe)),
          vals.reinsc!==undefined ? vals.reinsc : String(getTarifReinsc(classe))
        );
      }
      setEditing({});
    } finally { setSaving(false); }
  };

  const modifie = Object.keys(editing).length > 0;

  const field = (classe, champ, getVal, color) => {
    const cur = editing[classe]?.[champ];
    return (
      <input type="number" value={cur!==undefined ? cur : String(getVal(classe))}
        onChange={e=>canEdit&&handleChange(classe, champ, e.target.value)}
        readOnly={!canEdit}
        style={{width:90,border:"1px solid #d1d5db",borderRadius:6,padding:"4px 6px",fontSize:11,
          textAlign:"right",color:cur!==undefined?"#d97706":color,fontWeight:700,
          background:canEdit?"#fff":"#f3f4f6",cursor:canEdit?"text":"default"}}
      />
    );
  };

  return (
    <div style={{marginBottom:16,border:"1px solid #b0c4d8",borderRadius:10,overflow:"hidden"}}>
      <button onClick={()=>setOuvert(o=>!o)}
        style={{width:"100%",background:"#f0f6ff",border:"none",padding:"11px 16px",cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13,fontWeight:700,color:C.blueDark}}>
        <span>ðŸ’° Tarifs par classe (mensualitÃ© Â· inscription Â· rÃ©inscription)</span>
        <span style={{fontSize:11,fontWeight:400,color:"#6b7280"}}>{ouvert?"â–² Fermer":"â–¼ Voir / Modifier"}</span>
      </button>
      {ouvert&&(
        <div style={{padding:"16px 18px",background:"#fff"}}>
          {!canEdit&&<p style={{margin:"0 0 12px",fontSize:12,color:"#9ca3af"}}>Lecture seule â€” seuls le comptable, l'administrateur et la direction peuvent modifier les tarifs.</p>}
          {["primaire", "college", "lycee"].map((section) => {
            const classes = getClassesForSection(section);
            return (
              <div key={section} style={{marginBottom:16}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.05em"}}>{getSectionLabel(section)}</p>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#f0f6ff"}}>
                    <th style={{padding:"6px 10px",textAlign:"left",color:C.blueDark}}>Classe</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:C.blue}}>MensualitÃ© (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#059669"}}>Inscription (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#7c3aed"}}>RÃ©inscription (GNF)</th>
                  </tr></thead>
                  <tbody>{classes.map(classe=>(
                    <tr key={classe} style={{borderBottom:"1px solid #e5e7eb"}}>
                      <td style={{padding:"6px 10px",fontWeight:700,color:C.blueDark}}>{classe}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"mens",getTarif,C.blue)}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"ins",getTarifIns,"#059669")}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"reinsc",getTarifReinsc,"#7c3aed")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            );
          })}
          {canEdit&&(
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <Btn onClick={sauvegarderTout} disabled={saving||!modifie} v={modifie?"success":"ghost"}>
                {saving?"Enregistrementâ€¦":"ðŸ’¾ Enregistrer les tarifs"}
              </Btn>
              {modifie&&<Btn v="ghost" onClick={()=>setEditing({})}>Annuler</Btn>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CAPTURE CAMÃ‰RA

export { TarifsClasses };

