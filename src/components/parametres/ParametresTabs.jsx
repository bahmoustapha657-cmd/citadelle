import { C } from "../../constants";

// Barre d'onglets de l'écran Paramètres (identité, évaluations, accueil, etc.).
export function ParametresTabs({ tabItems, tabParam, setTabParam }) {
  return (
    <div style={{display:"flex",gap:4,background:"#f1f5f9",borderRadius:12,padding:4,marginBottom:24,width:"fit-content"}}>
      {tabItems.map(t=>(
        <button key={t.id} onClick={()=>setTabParam(t.id)} style={{
          padding:"8px 18px",border:"none",borderRadius:9,cursor:"pointer",
          fontSize:13,fontWeight:700,
          background:tabParam===t.id?"#fff":"transparent",
          color:tabParam===t.id?C.blueDark:"#64748b",
          boxShadow:tabParam===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
          transition:"all .15s",
        }}>{t.label}</button>
      ))}
    </div>
  );
}
