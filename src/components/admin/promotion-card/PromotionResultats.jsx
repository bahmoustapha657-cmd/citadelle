import { C } from "../../../constants";

// Résultats d'une promotion : compteurs (promus/redoublants/fin de cycle/sans
// notes) et table détaillée repliable par élève.
export function PromotionResultats({ promoRes }) {
  if (!promoRes) return null;
  return (
    <>
      {promoRes.simulation&&<div style={{background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#1e40af",fontWeight:700}}>
        🔍 Simulation — aucune modification n'a été appliquée. Vérifiez le détail puis cliquez « Appliquer cette promotion ».
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:12}}>
        <div style={{background:"#dcfce7",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#15803d"}}>{promoRes.promus}</div>
          <div style={{fontSize:11,color:"#15803d"}}>✅ Promus</div>
        </div>
        <div style={{background:"#fee2e2",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#b91c1c"}}>{promoRes.redoublants}</div>
          <div style={{fontSize:11,color:"#b91c1c"}}>🔁 Redoublants</div>
        </div>
        <div style={{background:"#fef9c3",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#854d0e"}}>{promoRes.terminalistes}</div>
          <div style={{fontSize:11,color:"#854d0e"}}>🏁 Fin de cycle</div>
        </div>
        {promoRes.sansNotes>0&&<div style={{background:"#f3f4f6",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#6b7280"}}>{promoRes.sansNotes}</div>
          <div style={{fontSize:11,color:"#6b7280"}}>📭 Sans notes</div>
        </div>}
        {promoRes.inconnus>0&&<div style={{background:"#fef2f2",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:900,color:"#b91c1c"}}>{promoRes.inconnus}</div>
          <div style={{fontSize:11,color:"#b91c1c"}}>❓ Classe non reconnue</div>
        </div>}
      </div>
      {promoRes.classesInconnues?.length>0&&<p style={{margin:"0 0 12px",fontSize:11,color:"#b91c1c"}}>
        Classes non reconnues (élèves non touchés) : <strong>{promoRes.classesInconnues.join(", ")}</strong>.
        Renommez-les au format « Nème Année X » ou promouvez ces élèves manuellement.
      </p>}
      {promoRes.details&&promoRes.details.length>0&&<details style={{marginBottom:12}}>
        <summary style={{fontSize:12,cursor:"pointer",color:C.blue,fontWeight:700}}>
          Voir le détail ({promoRes.details.length} élèves)
        </summary>
        <div style={{overflowX:"auto",marginTop:8}}>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1" style={{fontSize:12}}>
            <thead><tr style={{background:"#f0f6ff"}}>
              <th style={{padding:"5px 8px",textAlign:"left"}}>Éleve</th>
              <th style={{padding:"5px 8px"}}>Classe actuelle</th>
              <th style={{padding:"5px 8px"}}>Moy. annuelle</th>
              <th style={{padding:"5px 8px"}}>Décision</th>
              <th style={{padding:"5px 8px"}}>Nouvelle classe</th>
            </tr></thead>
            <tbody>{promoRes.details.map((d,i)=>(
              <tr key={i} style={{borderBottom:"1px solid #e5e7eb",background:d.statut==="promu"?"#f0fdf4":"#fef2f2"}}>
                <td style={{padding:"4px 8px",fontWeight:700}}>{d.nom}</td>
                <td style={{padding:"4px 8px",textAlign:"center"}}>{d.classe}</td>
                <td style={{padding:"4px 8px",textAlign:"center",fontWeight:800,
                  color:d.moy===null?"#9ca3af":d.statut==="promu"?"#15803d":"#b91c1c"}}>
                  {d.moy===null?"—":d.moy.toFixed(2)}
                </td>
                <td style={{padding:"4px 8px",textAlign:"center"}}>
                  <span style={{padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700,
                    background:d.statut==="promu"?"#dcfce7":"#fee2e2",
                    color:d.statut==="promu"?"#15803d":"#b91c1c"}}>
                    {d.statut==="promu"?"OK Promu":"🔁 Redoublant"}
                  </span>
                </td>
                <td style={{padding:"4px 8px",textAlign:"center",color:"#6b7280"}}>
                  {d.nouvClasse||"—"}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      </details>}
    </>
  );
}
