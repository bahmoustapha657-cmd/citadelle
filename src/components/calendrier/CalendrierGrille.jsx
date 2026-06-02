import { C } from "../../constants";
import { Btn, Card, Vide } from "../ui";
import { typeEv } from "./calendrier-data";

// Grille des événements par mois (ou état vide).
export function CalendrierGrille({ evenements, evParMois, supEv }) {
  if (evenements.length === 0) return <Vide icone="📅" msg="Aucun événement — cliquez sur + Ajouter"/>;
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
      {evParMois.map(({mois,evs})=>(
        <Card key={mois}><div style={{padding:"12px 16px"}}>
          <p style={{margin:"0 0 10px",fontWeight:800,fontSize:14,color:C.blueDark,borderBottom:"2px solid #e0ebf8",paddingBottom:6}}>{mois}</p>
          {evs.map(ev=>{
            const t=typeEv(ev.type);
            return <div key={ev._id} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8,padding:"8px 10px",borderRadius:7,background:"#f8fafc",borderLeft:`3px solid ${t.color}`}}>
              <div style={{flex:1}}>
                <p style={{margin:0,fontWeight:700,fontSize:12,color:C.blueDark}}>{ev.titre}</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#6b7280"}}>
                  {ev.date}{ev.dateFin&&ev.dateFin!==ev.date?` → ${ev.dateFin}`:""} ·
                  <span style={{color:t.color,fontWeight:600}}> {t.label}</span>
                  {ev.niveau&&ev.niveau!=="Tous"&&<span style={{color:"#9ca3af"}}> · {ev.niveau}</span>}
                </p>
                {ev.description&&<p style={{margin:"3px 0 0",fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>{ev.description}</p>}
              </div>
              <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer cet événement ?"))supEv(ev._id);}}>×</Btn>
            </div>;
          })}
        </div></Card>
      ))}
    </div>
  );
}
