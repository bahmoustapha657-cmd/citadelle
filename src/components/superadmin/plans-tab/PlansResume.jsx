import { PLANS } from "../../../constants";

// Résumé par plan : nombre d'écoles et alertes d'expiration.
export function PlansResume({ ecoles, now }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
      {Object.entries(PLANS).map(([key,info])=>{
        const count = ecoles.filter(e=>(e.plan||"gratuit")===key).length;
        const expired = key!=="gratuit" ? ecoles.filter(e=>e.plan===key&&e.planExpiry&&now>e.planExpiry).length : 0;
        return (
          <div key={key} style={{background:"#fff",borderRadius:12,padding:"14px 16px",boxShadow:"0 2px 12px rgba(0,32,80,0.07)",borderTop:`4px solid ${info.couleur}`}}>
            <div style={{fontSize:22,fontWeight:900,color:info.couleur}}>{count}</div>
            <div style={{fontSize:13,fontWeight:700,color:"#374151",marginTop:2}}>{info.label}</div>
            {expired>0&&<div style={{fontSize:11,color:"#ef4444",marginTop:2}}>Alerte: {expired} expire{expired>1?"s":""}</div>}
          </div>
        );
      })}
    </div>
  );
}
