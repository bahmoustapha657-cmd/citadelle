import React from "react";
import { C } from "../../constants";

// Onglet "Évaluations" de ParametresEcole.
// Chaque école peut renommer les formes affichées (Devoir, Composition…)
// et activer/désactiver celles qu'elle utilise. Les calculs internes
// restent stables ; seul le libellé varie.
export function EvaluationsTab({
  evaluationForms,
  setEvaluationLabel,
  toggleEvaluationActive,
  inp,
  sec,
}) {
  return (
    <div style={sec}>
      <h3 style={{margin:"0 0 10px",fontSize:14,fontWeight:800,color:C.blueDark}}>Formes d'evaluation</h3>
      <p style={{margin:"0 0 16px",fontSize:12,color:"#64748b"}}>
        Chaque ecole peut renommer les formes affichees, et activer seulement celles qu'elle utilise.
        Les calculs restent stables en interne.
      </p>
      {[
        { id: "primaire", title: "Primaire" },
        { id: "secondaire", title: "Secondaire" },
        { id: "examens", title: "Examens" },
      ].map((group) => (
        <div key={group.id} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:"16px 18px",marginBottom:14,background:"#f8fafc"}}>
          <h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:800,color:C.blueDark}}>{group.title}</h4>
          <div style={{display:"grid",gap:10}}>
            {(evaluationForms[group.id] || []).map((item) => (
              <div key={item.id} style={{display:"grid",gridTemplateColumns:"minmax(140px,180px) 1fr auto",gap:10,alignItems:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#475569"}}>{item.value}</div>
                <input
                  style={inp}
                  value={item.label}
                  onChange={(e)=>setEvaluationLabel(group.id, item.id, e.target.value)}
                  placeholder={item.value}
                />
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,fontWeight:700,color:item.active?C.greenDk:"#64748b",cursor:"pointer",whiteSpace:"nowrap"}}>
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={()=>toggleEvaluationActive(group.id, item.id)}
                  />
                  {item.active ? "Active" : "Masquee"}
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
