import React, { useState } from "react";
import { C, TOUTES_ANNEES } from "../../constants";
import { Btn, Card } from "../ui";
import { useClotureAnnee } from "./annee/use-cloture-annee";

// Année scolaire de l'école (ecoles/{id}.anneeScolaire — partagée entre tous
// les appareils). Modification réservée à la Direction : les règles Firestore
// refusent l'écriture aux autres rôles, autant ne pas leur montrer les
// contrôles.
//
// Avancer d'une année CLÔTURE celle qui se termine : la scolarité de chaque
// élève (mois payés, dates, montants, frais, inscription) est archivée sur sa
// fiche, puis les compteurs repartent à zéro. Sans cela, la rentrée héritait
// des mois cochés de l'année précédente. L'opération reste réversible.
export function AnneeScolaireCard({ annee, setAnnee, canEdit = true, schoolId, toast = () => {} }) {
  const cl = useClotureAnnee({ schoolId, annee, setAnnee, toast });
  const [anneeAAnnuler, setAnneeAAnnuler] = useState("");
  const anneesAnterieures = TOUTES_ANNEES.filter((a) => a < annee);

  return (
    <Card style={{marginBottom:20,padding:"16px 20px"}}>
      <p style={{margin:"0 0 12px",fontWeight:800,fontSize:14,color:C.blueDark}}>📅 Année scolaire</p>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {canEdit ? (
          <>
            <select value={annee} disabled={cl.enCours} onChange={e=>cl.changerAnnee(e.target.value)}
              style={{border:"2px solid "+C.blue,borderRadius:8,padding:"8px 14px",fontSize:15,fontWeight:800,color:C.blueDark,background:"#fff"}}>
              {TOUTES_ANNEES.map(a=><option key={a}>{a}</option>)}
            </select>
            <Btn v="success" disabled={cl.enCours} onClick={()=>{
              const idx=TOUTES_ANNEES.indexOf(annee);
              if(idx<TOUTES_ANNEES.length-1)cl.changerAnnee(TOUTES_ANNEES[idx+1]);
            }}>{cl.enCours ? "⏳ Clôture en cours…" : "▶ Année suivante"}</Btn>
            <Btn v="ghost" disabled={cl.enCours} onClick={()=>{
              const idx=TOUTES_ANNEES.indexOf(annee);
              if(idx>0)cl.changerAnnee(TOUTES_ANNEES[idx-1]);
            }}>◀ Année précédente</Btn>
          </>
        ) : (
          <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>🔒 Modification réservée à la Direction Générale.</span>
        )}
        <span style={{fontSize:13,color:C.green,fontWeight:700}}>Année active : <strong>{annee}</strong></span>
      </div>

      {canEdit&&<p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0"}}>
        Passer à l'année suivante archive la scolarité de l'année qui se termine (mois payés, dates,
        montants, frais, inscription) sur chaque fiche élève, puis remet les compteurs à zéro.
        Reculer d'une année ne modifie rien. L'opération est réversible ci-dessous.
      </p>}

      {/* ── Bilan de la dernière clôture, avec annulation immédiate ── */}
      {cl.resultat && (
        <div style={{marginTop:14,padding:"12px 14px",background:"#eaf4e0",border:"1px solid #86c06c",borderRadius:10}}>
          <p style={{margin:"0 0 6px",fontWeight:800,fontSize:13,color:C.greenDk}}>
            ✅ Année {cl.resultat.annee} clôturée — année active : {cl.resultat.nouvelle}
          </p>
          <p style={{margin:"0 0 10px",fontSize:12,color:"#3f6212"}}>
            {cl.resultat.archives} fiche(s) archivée(s) sur {cl.resultat.total}
            {cl.resultat.avecPaiements > 0 ? ` · ${cl.resultat.avecPaiements} avec des encaissements` : ""}
            {cl.resultat.dejaArchives > 0 ? ` · ${cl.resultat.dejaArchives} déjà archivée(s) auparavant` : ""}.
          </p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn sm v="danger" disabled={cl.enCours} onClick={()=>cl.annulerPour(cl.resultat.annee)}>↩️ Annuler la clôture</Btn>
            <Btn sm v="ghost" onClick={()=>cl.setResultat(null)}>Fermer</Btn>
          </div>
        </div>
      )}

      {cl.annulation && (
        <div style={{marginTop:14,padding:"12px 14px",background:"#fef3c7",border:"1px solid #fbbf24",borderRadius:10}}>
          <p style={{margin:0,fontSize:12,color:"#92400e"}}>
            ↩️ Clôture de {cl.annulation.annee} annulée : {cl.annulation.restaures} fiche(s) restaurée(s)
            {cl.annulation.ecrases > 0 ? ` (dont ${cl.annulation.ecrases} qui avaient des paiements plus récents)` : ""}.
          </p>
        </div>
      )}

      {/* ── Annuler la clôture d'une année plus ancienne ── */}
      {canEdit && anneesAnterieures.length > 0 && (
        <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--lc-border)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>Rouvrir une année clôturée :</span>
          <select value={anneeAAnnuler} disabled={cl.enCours} onChange={(e)=>setAnneeAAnnuler(e.target.value)}
            style={{border:"1px solid #cbd5e1",borderRadius:8,padding:"6px 10px",fontSize:12}}>
            <option value="">— choisir —</option>
            {anneesAnterieures.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <Btn sm v="ghost" disabled={cl.enCours || !anneeAAnnuler} onClick={()=>cl.annulerPour(anneeAAnnuler)}>
            ↩️ Restaurer cette année
          </Btn>
        </div>
      )}
    </Card>
  );
}
