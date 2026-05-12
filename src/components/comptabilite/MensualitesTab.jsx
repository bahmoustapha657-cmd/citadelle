import React from "react";
import { C, fmt, initMens, getAnnee, getSectionLabelForClasse } from "../../constants";
import { Badge, Btn, THead, TR, TD, Vide } from "../ui";
import { exportExcel, imprimerRecu } from "../../reports";
import {
  countUnpaidMonths,
  getElevesCritiques,
  getEleveMensualiteSnapshot,
  getMensualiteOverview,
} from "../../mensualite-utils";
import { TarifsClasses } from "../TarifsClasses";

export function MensualitesTab({
  // tarifs
  tarifsClasses,
  saveTarif,
  getTarifBase,
  getTarifRevision,
  getTarifAutre,
  getTarifIns,
  getTarifReinsc,
  canEditEleves,
  // mensualités
  eleves,
  elevesFiltres,
  classesU,
  niveau,
  setNiveau,
  filtClasse,
  setFiltClasse,
  moisAnnee,
  annee,
  readOnly,
  canCreate,
  canEdit,
  schoolInfo,
  toggleMens,
  toggleFraisAnnexe,
  getTarifInscriptionEleve,
  getTarif,
}) {
  return (
    <div>
      {/* ── Tarifs par classe ── */}
      <TarifsClasses
        tarifsClasses={tarifsClasses}
        saveTarif={saveTarif}
        getTarifBase={getTarifBase}
        getTarifRevision={getTarifRevision}
        getTarifAutre={getTarifAutre}
        getTarifIns={getTarifIns}
        getTarifReinsc={getTarifReinsc}
        canEdit={canEditEleves}
      />

      {(()=>{
        const elevesCritiques=getElevesCritiques(eleves, moisAnnee, 3);
        return elevesCritiques.length>0?(
          <div style={{background:"#fce8e8",border:"1px solid #f5c1c1",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>🚨</span>
              <strong style={{fontSize:13,color:"#9b2020"}}>Alertes mensualités — {elevesCritiques.length} élève(s) avec 3 mois ou plus impayés</strong>
              <Btn sm v="ghost" style={{marginLeft:"auto"}} onClick={()=>exportExcel(
                "Alertes_Mensualites",
                ["Matricule","Nom","Prénom","Classe","Niveau","Mois impayés","Tuteur","Contact"],
                elevesCritiques.map(e=>{
                  const niv=getSectionLabelForClasse(e.classe);
                  const nbImp=countUnpaidMonths(e, moisAnnee);
                  return [e.matricule||"",e.nom,e.prenom,e.classe,niv,nbImp,e.tuteur||"",e.contactTuteur||""];
                })
              )}>📥 Exporter</Btn>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {elevesCritiques.map(e=>{
                const nbImp=countUnpaidMonths(e, moisAnnee);
                return <div key={e._id} style={{background:"#fff",border:"1px solid #f5c1c1",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                  <span style={{fontWeight:800,color:"#9b2020"}}>{e.nom} {e.prenom}</span>
                  <span style={{color:"#6b7280"}}> · {e.classe} · </span>
                  <Badge color="red">{nbImp} impayés</Badge>
                </div>;
              })}
            </div>
          </div>
        ):null;
      })()}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,flex:1,color:C.blueDark}}>Mensualités — {annee||getAnnee()}</strong>
        <select value={niveau} onChange={e=>{setNiveau(e.target.value);setFiltClasse("all");}}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="college">Collège</option>
          <option value="lycee">Lycée</option>
          <option value="primaire">Primaire</option>
        </select>
        {classesU.length>0&&<select value={filtClasse} onChange={e=>setFiltClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark}}>
          <option value="all">Toutes les classes</option>
          {classesU.map(c=><option key={c}>{c}</option>)}
        </select>}
      </div>
        {eleves.length===0?<Vide icone="🎓" msg="Aucun élève"/>
          :(()=>{
            const overview = getMensualiteOverview(elevesFiltres, moisAnnee, tarifsClasses);
            return <>
            <div style={{marginBottom:12,padding:"9px 14px",background:"#e0ebf8",borderRadius:8,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.greenDk,fontWeight:700}}>✓ {overview.totalPayes} payés</span>
              <span style={{fontSize:12,color:"#b91c1c",fontWeight:700}}>✗ {overview.totalImpayes} impayés</span>
              <span style={{fontSize:12,color:C.blue,fontWeight:700}}>💰 {fmt(overview.totalPercu)}</span>
              <Badge color="purple">{fmt(overview.totalInscriptionsPercues)} inscriptions perçues</Badge>
              <Badge color="gray">{fmt(overview.totalAutresPercus)} autres frais perçus</Badge>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:1080}}>
                <THead cols={["Matricule","Nom & Prénom","Classe","Tuteur","Contact",...moisAnnee,"Payés","Ins.","Autre","Reçu"]}/>
                <tbody>{elevesFiltres.map(e=>{
                  const mens=e.mens||initMens();
                  const snapshot = getEleveMensualiteSnapshot(e, moisAnnee, tarifsClasses);
                  const montantInscription = getTarifInscriptionEleve(e);
                  const montantAutre = getTarifAutre(e.classe);
                  return <TR key={e._id}>
                    <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 6px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                    <TD bold>{e.nom} {e.prenom}</TD>
                    <TD><Badge color="blue">{e.classe}</Badge></TD>
                    <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
                    {moisAnnee.map(m=>{
                      const paye=mens[m]==="Payé";
                      const datePaie=(e.mensDates||{})[m]||"";
                      const peutCliquer=paye?(canCreate&&canEdit):canCreate;
                      return <td key={m} style={{padding:"4px 2px",textAlign:"center"}}>
                        <button onClick={()=>peutCliquer&&toggleMens(e._id,m,mens,e.mensDates||{},`${e.nom} ${e.prenom}`)}
                          title={`${m} — ${mens[m]||"Impayé"}${datePaie?" ("+datePaie+")":""}`}
                          style={{width:26,height:26,borderRadius:5,border:"none",cursor:peutCliquer?"pointer":"default",fontSize:12,
                            background:paye?C.green:"#e8f0e8",color:paye?"#fff":"#9ca3af",fontWeight:700,opacity:(readOnly||(!peutCliquer&&!paye))?0.6:1}}>
                          {paye?"✓":"·"}
                        </button>
                      </td>;
                    })}
                    <td style={{padding:"4px 8px",textAlign:"center"}}>
                      <span style={{fontWeight:800,fontSize:13,color:snapshot.nbPayes===moisAnnee.length?C.greenDk:snapshot.nbPayes>0?"#d97706":"#b91c1c"}}>
                        {snapshot.nbPayes}/{moisAnnee.length}
                      </span>
                    </td>
                    <td style={{padding:"4px 4px",textAlign:"center"}}>
                      <button onClick={()=>toggleFraisAnnexe(e._id,{
                        payKey:"inscriptionPayee",
                        dateKey:"inscriptionDate",
                        valeurActuelle:e.inscriptionPayee,
                        label:e.typeInscription==="Réinscription"?"Réinscription":"Inscription",
                        montant:montantInscription,
                        nomEleve:`${e.nom} ${e.prenom}`,
                      })} title={`${e.typeInscription==="Réinscription"?"Réinscription":"Inscription"}${e.inscriptionDate?` (${e.inscriptionDate})`:""}`}
                        style={{width:26,height:26,borderRadius:5,border:"none",cursor:readOnly?"default":"pointer",fontSize:11,
                          background:e.inscriptionPayee?C.blue:"#f1f3f4",color:e.inscriptionPayee?"#fff":"#9ca3af",fontWeight:700}}>
                        {e.inscriptionPayee?"✓":"I"}
                      </button>
                    </td>
                    <td style={{padding:"4px 4px",textAlign:"center"}}>
                      <button onClick={()=>toggleFraisAnnexe(e._id,{
                        payKey:"autrePayee",
                        dateKey:"autreDate",
                        valeurActuelle:e.autrePayee,
                        label:"Autre frais",
                        montant:montantAutre,
                        nomEleve:`${e.nom} ${e.prenom}`,
                      })} title={`Autre frais${e.autreDate?` (${e.autreDate})`:""}`}
                        style={{width:26,height:26,borderRadius:5,border:"none",cursor:readOnly?"default":"pointer",fontSize:11,
                          background:e.autrePayee?"#475569":"#f1f3f4",color:e.autrePayee?"#fff":"#9ca3af",fontWeight:700}}>
                        {e.autrePayee?"✓":"A"}
                      </button>
                    </td>
                    <td style={{padding:"4px 6px",textAlign:"center"}}>
                      <Btn sm v="amber" onClick={()=>imprimerRecu(e,getTarif(e.classe),schoolInfo,moisAnnee,{
                        inscription: montantInscription,
                        autre: montantAutre,
                      })}>🖨️</Btn>
                    </td>
                  </TR>;
                })}</tbody>
              </table>
            </div>
          </>;
          })()}
    </div>
  );
}
