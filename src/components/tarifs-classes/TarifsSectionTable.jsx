import { C, getClassesForSection, getSectionLabel } from "../../constants";

// Tableau des tarifs d'une section (primaire/college/lycee) : une ligne par
// classe, un input par champ (orange si modifié localement) et le total
// mensuel prévisualisé.
export function TarifsSectionTable({
  section, editing, canEdit, handleChange, getPreviewTotal,
  getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc,
}) {
  const classes = getClassesForSection(section);

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
    <div style={{marginBottom:16}}>
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
}
