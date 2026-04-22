import React, { useState } from "react";
import { C, getClassesForSection, getSectionLabel } from "../constants";
import { Btn } from "./ui";

function TarifsClasses({
  saveTarif,
  getTarifBase,
  getTarifRevision,
  getTarifAutre,
  getTarifIns,
  getTarifReinsc,
  canEdit,
}) {
  const [ouvert, setOuvert] = useState(false);
  // editing: { "Classe X": {mens, revision, autre, ins, reinsc} }
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // {type: "success"|"error", msg}

  const handleChange = (classe, champ, val) =>
    setEditing(p=>({...p,[classe]:{...(p[classe]||{}), [champ]:val}}));

  const sauvegarderTout = async () => {
    if (saving) return;
    const entrees = Object.entries(editing);
    if (entrees.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const resultats = await Promise.allSettled(
        entrees.map(([classe, vals]) =>
          saveTarif(
            classe,
            vals.mens!==undefined ? vals.mens : String(getTarifBase(classe)),
            vals.ins!==undefined  ? vals.ins  : String(getTarifIns(classe)),
            vals.reinsc!==undefined ? vals.reinsc : String(getTarifReinsc(classe)),
            vals.revision!==undefined ? vals.revision : String(getTarifRevision(classe)),
            vals.autre!==undefined ? vals.autre : String(getTarifAutre(classe))
          )
        )
      );
      const echecs = resultats
        .map((r, i) => ({ r, classe: entrees[i][0] }))
        .filter(({ r }) => r.status === "rejected");
      if (echecs.length === 0) {
        setEditing({});
        setFeedback({ type: "success", msg: `✅ ${entrees.length} tarif${entrees.length>1?"s":""} enregistré${entrees.length>1?"s":""}.` });
      } else {
        const restant = {};
        echecs.forEach(({ classe }) => {
          if (editing[classe]) restant[classe] = editing[classe];
        });
        setEditing(restant);
        const premier = echecs[0].r.reason;
        setFeedback({
          type: "error",
          msg: `❌ ${echecs.length} échec${echecs.length>1?"s":""} : ${premier?.message || "écriture refusée"}. Vos saisies sont conservées.`,
        });
      }
    } catch (e) {
      setFeedback({ type: "error", msg: `❌ Erreur inattendue : ${e?.message || "écriture refusée"}.` });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
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

  const getPreviewTotal = (classe) => {
    const base = editing[classe]?.mens!==undefined ? Number(editing[classe].mens || 0) : Number(getTarifBase(classe) || 0);
    const revision = editing[classe]?.revision!==undefined ? Number(editing[classe].revision || 0) : Number(getTarifRevision(classe) || 0);
    return base + revision;
  };

  return (
    <div style={{marginBottom:16,border:"1px solid #b0c4d8",borderRadius:10,overflow:"hidden"}}>
      <button onClick={()=>setOuvert(o=>!o)}
        style={{width:"100%",background:"#f0f6ff",border:"none",padding:"11px 16px",cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13,fontWeight:700,color:C.blueDark}}>
        <span>Tarifs par classe (mensualité, révision incluse, autre, inscription, réinscription)</span>
        <span style={{fontSize:11,fontWeight:400,color:"#6b7280"}}>{ouvert?"Fermer":"Voir / Modifier"}</span>
      </button>
      {ouvert&&(
        <div style={{padding:"16px 18px",background:"#fff"}}>
          {!canEdit&&<p style={{margin:"0 0 12px",fontSize:12,color:"#9ca3af"}}>Lecture seule - seuls le comptable, l'administrateur et la direction peuvent modifier les tarifs.</p>}
          <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>
            La mensualité facturée par élève additionne automatiquement la mensualité de base et le frais de révision.
          </p>
          {["primaire", "college", "lycee"].map((section) => {
            const classes = getClassesForSection(section);
            return (
              <div key={section} style={{marginBottom:16}}>
                <p style={{margin:"0 0 8px",fontSize:12,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.05em"}}>{getSectionLabel(section)}</p>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#f0f6ff"}}>
                    <th style={{padding:"6px 10px",textAlign:"left",color:C.blueDark}}>Classe</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:C.blue}}>Mensualité de base (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#b45309"}}>Révision (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#475569"}}>Autre (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#059669"}}>Inscription (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#7c3aed"}}>Réinscription (GNF)</th>
                    <th style={{padding:"6px 10px",textAlign:"right",color:"#0f172a"}}>Mensualité totale</th>
                  </tr></thead>
                  <tbody>{classes.map(classe=>(
                    <tr key={classe} style={{borderBottom:"1px solid #e5e7eb"}}>
                      <td style={{padding:"6px 10px",fontWeight:700,color:C.blueDark}}>{classe}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"mens",getTarifBase,C.blue)}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"revision",getTarifRevision,"#b45309")}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"autre",getTarifAutre,"#475569")}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"ins",getTarifIns,"#059669")}</td>
                      <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"reinsc",getTarifReinsc,"#7c3aed")}</td>
                      <td style={{padding:"4px 10px",textAlign:"right",fontWeight:800,color:"#0f172a"}}>{getPreviewTotal(classe).toLocaleString("fr-FR")}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            );
          })}
          {feedback&&(
            <div style={{
              marginTop:10,padding:"8px 12px",borderRadius:8,fontSize:12,fontWeight:600,
              background:feedback.type==="success"?"#d1fae5":"#fee2e2",
              color:feedback.type==="success"?"#065f46":"#991b1b",
              border:`1px solid ${feedback.type==="success"?"#6ee7b7":"#fca5a5"}`,
            }}>{feedback.msg}</div>
          )}
          {canEdit&&(
            <div style={{display:"flex",gap:10,marginTop:8,alignItems:"center"}}>
              <Btn onClick={sauvegarderTout} disabled={saving||!modifie} v={modifie?"success":"ghost"}>
                {saving?"Enregistrement...":"Enregistrer les tarifs"}
              </Btn>
              {modifie&&!saving&&<Btn v="ghost" onClick={()=>setEditing({})}>Annuler</Btn>}
              {!modifie&&!saving&&!feedback&&(
                <span style={{fontSize:11,color:"#9ca3af"}}>Modifiez au moins un tarif pour activer le bouton.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}




export { TarifsClasses };
