import React from "react";
import { C, TOUTES_ANNEES } from "../../constants";
import { Btn, Card } from "../ui";

// Année scolaire de l'école (ecoles/{id}.anneeScolaire — partagée entre tous
// les appareils). Modification réservée à la Direction : les règles Firestore
// refusent l'écriture aux autres rôles, autant ne pas leur montrer les
// contrôles.
export function AnneeScolaireCard({ annee, setAnnee, canEdit = true }) {
  return (
    <Card style={{marginBottom:20,padding:"16px 20px"}}>
      <p style={{margin:"0 0 12px",fontWeight:800,fontSize:14,color:C.blueDark}}>📅 Année scolaire</p>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {canEdit ? (
          <>
            <select value={annee} onChange={e=>setAnnee(e.target.value)}
              style={{border:"2px solid "+C.blue,borderRadius:8,padding:"8px 14px",fontSize:15,fontWeight:800,color:C.blueDark,background:"#fff"}}>
              {TOUTES_ANNEES.map(a=><option key={a}>{a}</option>)}
            </select>
            <Btn v="success" onClick={()=>{
              const idx=TOUTES_ANNEES.indexOf(annee);
              if(idx<TOUTES_ANNEES.length-1)setAnnee(TOUTES_ANNEES[idx+1]);
            }}>▶ Année suivante</Btn>
            <Btn v="ghost" onClick={()=>{
              const idx=TOUTES_ANNEES.indexOf(annee);
              if(idx>0)setAnnee(TOUTES_ANNEES[idx-1]);
            }}>◀ Année précédente</Btn>
          </>
        ) : (
          <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>🔒 Modification réservée à la Direction Générale.</span>
        )}
        <span style={{fontSize:13,color:C.green,fontWeight:700}}>Année active : <strong>{annee}</strong></span>
      </div>
      {canEdit&&<p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0"}}>Attention : changer l'année affecte tous les modules de l'application, pour tous les utilisateurs de l'école.</p>}
    </Card>
  );
}
