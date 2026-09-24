import React from "react";
import { C, TOUTES_ANNEES } from "../../constants";
import { Btn, Card } from "../ui";
import { useClotureAnnee } from "./annee/use-cloture-annee";
import { dateLongue } from "./cloture-annee-utils";

// Année scolaire de l'école (ecoles/{id}.anneeScolaire — partagée entre tous
// les appareils). Modification réservée à la Direction : les règles Firestore
// refusent l'écriture aux autres rôles, autant ne pas leur montrer les
// contrôles.
//
// Avancer au-delà de l'année officielle CLÔTURE celle-ci : la scolarité de
// chaque élève (mois payés, dates, montants, frais, inscription) est archivée
// sur sa fiche, puis les compteurs repartent à zéro. Sans cela, la rentrée
// héritait des mois cochés de l'année précédente. L'opération reste
// réversible — tant que ni la promotion ni le passage des admis n'ont suivi.
export function AnneeScolaireCard({ annee, setAnnee, canEdit = true, schoolId, toast = () => {} }) {
  const cl = useClotureAnnee({ schoolId, annee, setAnnee, toast });
  const { cloture } = cl;
  // Le bouton suivant clôture seulement depuis l'année officielle ; depuis une
  // année consultée, il ne fait que revenir vers elle.
  const clotureBloquee = annee >= cl.anneeOfficielle && !cloture.possible;
  const finPrevue = cloture.fin ? new Date(cloture.fin.getTime() - 1) : null;

  return (
    <Card style={{marginBottom:20,padding:"16px 20px"}}>
      <p style={{margin:"0 0 12px",fontWeight:800,fontSize:14,color:C.blueDark}}>📅 Année scolaire</p>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {canEdit ? (
          <>
            <select value={annee} disabled={cl.enCours} onChange={e=>cl.changerAnnee(e.target.value)}
              style={{border:"2px solid "+C.blue,borderRadius:8,padding:"8px 14px",fontSize:15,fontWeight:800,color:C.blueDark,background:"#fff"}}>
              {TOUTES_ANNEES.map(a=>(
                <option key={a} disabled={a>cloture.suivante||(a===cloture.suivante&&!cloture.possible)}>{a}</option>
              ))}
            </select>
            <Btn v="success" disabled={cl.enCours||clotureBloquee} title={clotureBloquee?`Clôture possible à partir du ${dateLongue(cloture.fin)}`:""} onClick={()=>{
              const idx=TOUTES_ANNEES.indexOf(annee);
              if(idx<TOUTES_ANNEES.length-1)cl.changerAnnee(TOUTES_ANNEES[idx+1]);
            }}>{cl.enCours ? "⏳ Clôture en cours…" : annee<cl.anneeOfficielle ? "▶ Année suivante" : `▶ Clôturer ${cl.anneeOfficielle}`}</Btn>
            <Btn v="ghost" disabled={cl.enCours} onClick={()=>{
              const idx=TOUTES_ANNEES.indexOf(annee);
              if(idx>0)cl.changerAnnee(TOUTES_ANNEES[idx-1]);
            }}>◀ Année précédente</Btn>
          </>
        ) : (
          <span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>🔒 Modification réservée à la Direction Générale.</span>
        )}
        <span style={{fontSize:13,color:C.green,fontWeight:700}}>Année active : <strong>{cl.anneeOfficielle}</strong></span>
        {annee!==cl.anneeOfficielle&&<span style={{fontSize:12,color:"#92400e",fontWeight:700}}>(consultation de {annee})</span>}
      </div>

      {finPrevue&&<p style={{fontSize:12,margin:"10px 0 0",fontWeight:600,color:cloture.possible?C.greenDk:"#92400e"}}>
        {cloture.possible
          ? `✅ Année ${cl.anneeOfficielle} terminée (fin prévue le ${dateLongue(finPrevue)}) : elle peut être clôturée.`
          : `🔒 Fin prévue de l'année ${cl.anneeOfficielle} : ${dateLongue(finPrevue)}. Clôture possible à partir du ${dateLongue(cloture.fin)}.`}
      </p>}

      {canEdit&&<p style={{fontSize:11,color:"#9ca3af",margin:"8px 0 0"}}>
        Clôturer l'année archive sa scolarité (mois payés, dates, montants, frais, inscription) sur chaque
        fiche élève, puis remet les compteurs à zéro. Elle n'est possible qu'une fois l'année terminée — fin
        calculée depuis le mois de début réglé dans Paramètres — et ouvre la promotion et le passage des admis.
        Reculer d'une année ne modifie rien.
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

      {/* ── Rouvrir la dernière année clôturée ── */}
      {canEdit && cl.anneeRouvrable && !cl.resultat && (
        <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--lc-border)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:12,color:"#64748b",fontWeight:600}}>Rouvrir l'année clôturée {cl.anneeRouvrable} :</span>
          <Btn sm v="ghost" disabled={cl.enCours || !cl.rouvrable} onClick={()=>cl.annulerPour(cl.anneeRouvrable)}>
            ↩️ Restaurer cette année
          </Btn>
          {!cl.rouvrable&&<span style={{fontSize:11,color:"#9ca3af"}}>
            Impossible : sa promotion ou le passage de ses admis a déjà été appliqué.
          </span>}
        </div>
      )}
    </Card>
  );
}
