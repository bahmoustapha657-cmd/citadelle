import { C } from "../../../constants";

const TUILES = [
  { cle: "passes", label: "✅ Passent", bg: "#dcfce7", fg: "#15803d" },
  { cle: "diplomes", label: "🎓 Diplômés", bg: "#ede9fe", fg: "#6d28d9" },
  { cle: "refuses", label: "🔁 Refusés (restent)", bg: "#fee2e2", fg: "#b91c1c" },
  { cle: "attente", label: "⏳ Sans résultat", bg: "#e0ebf8", fg: "#1e40af" },
];

const DECISIONS = {
  passe: { texte: "Admis — passe", bg: "#dcfce7", fg: "#15803d" },
  diplome: { texte: "Admis — diplômé", bg: "#ede9fe", fg: "#6d28d9" },
  reste: { texte: "Refusé — reste", bg: "#fee2e2", fg: "#b91c1c" },
};

// Bilan d'un passage des admis (simulation ou application) : compteurs,
// classes dont les résultats manquent, détail repliable par élève.
export function PassageAdmisResultats({ res }) {
  if (!res) return null;
  if (!res.total) {
    return (
      <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
        Aucun élève en classe d'examen dans l'année clôturée {res.annee} — ou tous ont déjà été traités.
      </p>
    );
  }
  return (
    <>
      {res.simulation&&<div style={{background:"#eff6ff",border:"1px solid #93c5fd",borderRadius:8,padding:"8px 14px",marginBottom:10,fontSize:12,color:"#1e40af",fontWeight:700}}>
        🔍 Simulation — aucune modification n'a été appliquée.
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:12}}>
        {TUILES.map((t)=>(
          <div key={t.cle} style={{background:t.bg,borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
            <div style={{fontSize:20,fontWeight:900,color:t.fg}}>{res[t.cle]}</div>
            <div style={{fontSize:11,color:t.fg}}>{t.label}</div>
          </div>
        ))}
      </div>
      {res.attente>0&&<p style={{margin:"0 0 12px",fontSize:11,color:"#1e40af"}}>
        ⏳ Résultat non saisi pour {res.attente} élève(s){res.classesAttente?.length>0?` (${res.classesAttente.join(", ")})`:""} :
        ils ne sont pas touchés. Renseignez « Résultat d'examen » sur leur fiche (Comptabilité → Élèves), puis relancez.
      </p>}
      {res.details?.length>0&&<details style={{marginBottom:12}}>
        <summary style={{fontSize:12,cursor:"pointer",color:C.blue,fontWeight:700}}>
          Voir le détail ({res.details.length} élèves)
        </summary>
        <div style={{overflowX:"auto",marginTop:8}}>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1" style={{fontSize:12}}>
            <thead><tr style={{background:"#f0f6ff"}}>
              <th style={{padding:"5px 8px",textAlign:"left"}}>Élève</th>
              <th style={{padding:"5px 8px"}}>Classe d'examen</th>
              <th style={{padding:"5px 8px"}}>Décision</th>
              <th style={{padding:"5px 8px"}}>Nouvelle classe</th>
            </tr></thead>
            <tbody>{res.details.map((d,i)=>{
              const dec = DECISIONS[d.statut];
              return (
                <tr key={i} style={{borderBottom:"1px solid #e5e7eb"}}>
                  <td style={{padding:"4px 8px",fontWeight:700}}>{d.nom}</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>{d.classe}</td>
                  <td style={{padding:"4px 8px",textAlign:"center"}}>
                    <span style={{padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700,background:dec.bg,color:dec.fg}}>{dec.texte}</span>
                  </td>
                  <td style={{padding:"4px 8px",textAlign:"center",color:"#6b7280"}}>
                    {d.statut==="passe"?d.nouvClasse:d.statut==="diplome"?"Quitte l'établissement":"—"}
                    {d.nouvelleSection&&<div style={{fontSize:10,fontWeight:700,color:"#1e40af"}}>passe au {d.nouvelleSection}</div>}
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </div>
      </details>}
    </>
  );
}
