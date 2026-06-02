import { C } from "../../constants";
import { Badge } from "../ui";
import { typeEv } from "./calendrier-data";

// Bandeau "Prochains événements" (masqué si vide).
export function CalendrierProchains({ prochains }) {
  if (prochains.length === 0) return null;
  return (
    <div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
      <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>📌 Prochains événements</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {prochains.map(ev=>{
          const t=typeEv(ev.type);
          return <div key={ev._id} style={{background:"#fff",borderRadius:7,padding:"6px 12px",borderLeft:`3px solid ${t.color}`,fontSize:12}}>
            <span style={{fontWeight:700,color:C.blueDark}}>{ev.titre}</span>
            <span style={{color:"#9ca3af"}}> · {ev.date}</span>
            {ev.niveau&&ev.niveau!=="Tous"&&<Badge color="blue" style={{marginLeft:4}}>{ev.niveau}</Badge>}
          </div>;
        })}
      </div>
    </div>
  );
}
