import { useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { C, getClassesForSection, getSectionLabel, getSystemeScolaire } from "../../constants";

// Tableau des tarifs d'une section (primaire/college/lycee) : une ligne par
// classe, un input par champ (orange si modifié localement), les colonnes de
// frais annexes activés et le total mensuel prévisualisé. Le tableau défile
// horizontalement pour rester entièrement visible sur petit écran.
export function TarifsSectionTable({
  section, editing, canEdit, handleChange, getPreviewTotal,
  getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc,
  fraisVisibles = [], getFraisDiversVal,
}) {
  const { schoolInfo } = useContext(SchoolContext);
  const classes = getClassesForSection(section, getSystemeScolaire(schoolInfo));

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

  const th = (label, color) => (
    <th style={{padding:"6px 10px",textAlign:"right",color,whiteSpace:"nowrap"}}>{label}</th>
  );

  return (
    <div style={{marginBottom:16}}>
      <p style={{margin:"0 0 8px",fontSize:12,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.05em"}}>{getSectionLabel(section)}</p>
      {/* Défilement horizontal : le conteneur parent (bordure arrondie) est en
          overflow:hidden — sans ce wrapper, les colonnes de droite étaient
          rognées et invisibles. */}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",minWidth:640+fraisVisibles.length*110,borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#f0f6ff"}}>
            <th style={{padding:"6px 10px",textAlign:"left",color:C.blueDark}}>Classe</th>
            {th("Mensualité de base", C.blue)}
            {th("Révision", "#b45309")}
            {th("Inscription", "#059669")}
            {th("Réinscription", "#7c3aed")}
            {th("Autre frais", "#475569")}
            {fraisVisibles.map((f)=>th(f.label, "#0e7490"))}
            {th("Mensualité totale", "#0f172a")}
          </tr></thead>
          <tbody>{classes.map(classe=>(
            <tr key={classe} style={{borderBottom:"1px solid #e5e7eb"}}>
              <td style={{padding:"6px 10px",fontWeight:700,color:C.blueDark,whiteSpace:"nowrap"}}>{classe}</td>
              <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"mens",getTarifBase,C.blue)}</td>
              <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"revision",getTarifRevision,"#b45309")}</td>
              <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"ins",getTarifIns,"#059669")}</td>
              <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"reinsc",getTarifReinsc,"#7c3aed")}</td>
              <td style={{padding:"4px 10px",textAlign:"right"}}>{field(classe,"autre",getTarifAutre,"#475569")}</td>
              {fraisVisibles.map((f)=>(
                <td key={f.id} style={{padding:"4px 10px",textAlign:"right"}}>
                  {field(classe,`fd:${f.id}`,(cl)=>getFraisDiversVal(cl, f.id),"#0e7490")}
                </td>
              ))}
              <td style={{padding:"4px 10px",textAlign:"right",fontWeight:800,color:"#0f172a"}}>{getPreviewTotal(classe).toLocaleString("fr-FR")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
