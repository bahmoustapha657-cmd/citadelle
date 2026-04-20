import React from "react";
import { C } from "../constants";

//  PORTAIL PARENT
// ══════════════════════════════════════════════════════════════
// ── Écran de blocage accès parent (impayés) ──────────────────
function BlocagePaiement({moisImpayes=[], schoolInfo={}, onPaiements}) {
  const c1 = schoolInfo.couleur1||"#0A1628";
  return (
    <div style={{background:"#fff",borderRadius:16,border:"2px solid #fca5a5",padding:"36px 28px",textAlign:"center",maxWidth:500,margin:"0 auto"}}>
      <div style={{fontSize:52,marginBottom:12}}>🔒</div>
      <h3 style={{margin:"0 0 8px",fontSize:18,fontWeight:900,color:"#991b1b"}}>Accès restreint</h3>
      <p style={{margin:"0 0 16px",fontSize:14,color:"#6b7280",lineHeight:1.6}}>
        La consultation et l'impression des notes et bulletins sont temporairement suspendues
        car <strong>des mensualités sont en attente de règlement</strong>.
      </p>
      <div style={{background:"#fef2f2",borderRadius:10,padding:"12px 16px",marginBottom:20,display:"inline-block",textAlign:"left"}}>
        <div style={{fontSize:12,fontWeight:700,color:"#991b1b",marginBottom:6}}>Mois impayés :</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {moisImpayes.map(m=>(
            <span key={m} style={{background:"#fee2e2",color:"#b91c1c",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700}}>{m}</span>
          ))}
        </div>
      </div>
      <p style={{margin:"0 0 20px",fontSize:12,color:"#9ca3af"}}>
        Régularisez votre situation auprès de {schoolInfo.nom||"l'établissement"} pour retrouver l'accès complet.
      </p>
      {schoolInfo.telephone&&(
        <a href={`tel:${schoolInfo.telephone}`}
          style={{display:"inline-flex",alignItems:"center",gap:6,background:"#dcfce7",color:"#15803d",
            border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,textDecoration:"none",marginRight:8}}>
          📞 Appeler l'école
        </a>
      )}
      <button onClick={onPaiements}
        style={{background:c1,border:"none",color:"#fff",padding:"9px 22px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13}}>
        💳 Voir mes paiements
      </button>
    </div>
  );
}


export { BlocagePaiement };
