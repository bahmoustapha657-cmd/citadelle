import { C } from "../../../constants";

// Cartes de statistiques rapides des enseignements (masqué si aucun).
export function EnseignementsStats({ enseignements }) {
  if (enseignements.length === 0) return null;
  const stats = [
    {label:"Cours effectués",val:enseignements.filter(e=>e.statut==="Effectué").length,bg:"#eaf4e0",c:C.greenDk},
    {label:"Absences enseignants",val:enseignements.filter(e=>e.statut==="Absent").length,bg:"#fce8e8",c:"#b91c1c"},
    {label:"Retards",val:enseignements.filter(e=>e.statut==="Retard").length,bg:"#fef3e0",c:"#d97706"},
    {label:"Cours non effectués",val:enseignements.filter(e=>e.statut==="Non effectué").length,bg:"#e6f4ea",c:C.blue},
  ];
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
      {stats.map(s=><div key={s.label} style={{background:s.bg,borderRadius:9,padding:"10px 14px",border:"1px solid #e8eaed"}}>
        <p style={{fontSize:10,fontWeight:700,color:s.c,textTransform:"uppercase",margin:"0 0 2px",letterSpacing:"0.06em"}}>{s.label}</p>
        <p style={{fontSize:22,fontWeight:800,color:s.c,margin:0}}>{s.val}</p>
      </div>)}
    </div>
  );
}
