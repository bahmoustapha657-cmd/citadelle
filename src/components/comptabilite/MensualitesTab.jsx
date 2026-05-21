import React from "react";
import { useTranslation } from "react-i18next";
import { C, fmt, initMens, getAnnee, getSectionLabelForClasse } from "../../constants";
import { Badge, Btn, TR, TD, Vide } from "../ui";
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
  const { t } = useTranslation();
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
              <Btn sm v="ghost" style={{marginInlineStart:"auto"}} onClick={()=>exportExcel(
                t("reports.excel.files.paymentAlerts"),
                [t("reports.excel.headers.matricule"),t("reports.excel.headers.lastName"),t("reports.excel.headers.firstName"),t("reports.excel.headers.class"),t("reports.excel.headers.level"),t("reports.excel.headers.unpaidMonths"),t("reports.excel.headers.guardian"),t("reports.excel.headers.contact")],
                elevesCritiques.map(e=>{
                  const niv=getSectionLabelForClasse(e.classe);
                  const nbImp=countUnpaidMonths(e, moisAnnee);
                  return [e.matricule||"",e.nom,e.prenom,e.classe,niv,nbImp,e.tuteur||"",e.contactTuteur||""];
                })
              )}>📥 {t("common.export")}</Btn>
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
        <strong style={{fontSize:14,flex:1,color:C.blueDark}}>{t("accounting.monthly")} — {annee||getAnnee()}</strong>
        <select value={niveau} onChange={e=>{setNiveau(e.target.value);setFiltClasse("all");}}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="college">{t("dashboard.secondary")}</option>
          <option value="lycee">{t("dashboard.lycee")}</option>
          <option value="primaire">{t("dashboard.primary")}</option>
        </select>
        {classesU.length>0&&<select value={filtClasse} onChange={e=>setFiltClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark}}>
          <option value="all">{t("common.all")}</option>
          {classesU.map(c=><option key={c}>{c}</option>)}
        </select>}
      </div>
        {eleves.length===0?<Vide icone="🎓" msg="Aucun élève"/>
          :(()=>{
            const overview = getMensualiteOverview(elevesFiltres, moisAnnee, tarifsClasses);
            return <>
            <div style={{marginBottom:12,padding:"9px 14px",background:"#e0ebf8",borderRadius:8,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:12,color:C.greenDk,fontWeight:700}}>✓ {overview.totalPayes} {t("accounting.paid").toLowerCase()}</span>
              <span style={{fontSize:12,color:"#b91c1c",fontWeight:700}}>✗ {overview.totalImpayes} {t("accounting.unpaid").toLowerCase()}</span>
              <span style={{fontSize:12,color:C.blue,fontWeight:700}}>💰 {fmt(overview.totalPercu)}</span>
              <Badge color="purple">{fmt(overview.totalInscriptionsPercues)} inscriptions perçues</Badge>
              <Badge color="gray">{fmt(overview.totalAutresPercus)} autres frais perçus</Badge>
            </div>
            {/* Conteneur scroll : maxHeight pour activer sticky top sur l'en-tête,
                overflow:auto pour activer sticky left sur les 2 premières colonnes
                (Matricule + Nom). Le scroll vertical reste fluide dans la table sans
                que l'utilisateur perde le contexte. */}
            <div style={{
              maxHeight:"calc(100vh - 320px)",
              minHeight:300,
              overflow:"auto",
              border:"1px solid var(--lc-border)",
              borderRadius:8,
            }}>
              <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0,minWidth:1080}}>
                {(()=>{
                  // Styles partagés des en-têtes (gradient + texte clair) avec sticky-top.
                  // Les 2 premières colonnes ajoutent sticky-left → coin haut-gauche
                  // (z-index 3 pour passer au-dessus des autres TH).
                  const thBase = {
                    textAlign:"start",padding:"10px 13px",fontSize:10,fontWeight:700,
                    color:"rgba(255,255,255,0.9)",textTransform:"uppercase",letterSpacing:"0.08em",
                    whiteSpace:"nowrap",borderBottom:"2px solid var(--sc2)",
                    background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))",
                    position:"sticky",top:0,
                  };
                  const thStickyLeft = (left, z=3) => ({...thBase,left,zIndex:z});
                  const cols = ["Matricule","Nom & Prénom","Classe","Tuteur","Contact",...moisAnnee,"Payés","Ins.","Autre","Reçu"];
                  return (
                    <thead>
                      <tr>
                        <th style={thStickyLeft(0)}>{cols[0]}</th>
                        <th style={thStickyLeft(95)}>{cols[1]}</th>
                        {cols.slice(2).map((c,i)=>(
                          <th key={i} style={{...thBase,zIndex:2}}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                  );
                })()}
                <tbody>{elevesFiltres.map((e,rowIdx)=>{
                  const mens=e.mens||initMens();
                  const snapshot = getEleveMensualiteSnapshot(e, moisAnnee, tarifsClasses);
                  const montantInscription = getTarifInscriptionEleve(e);
                  const montantAutre = getTarifAutre(e.classe);
                  // Background explicite sur les cellules sticky : sinon le contenu
                  // des colonnes suivantes glisse "derrière" lors du scroll horizontal.
                  // Alterné pour préserver le zébrage visuel.
                  const stickyBg = rowIdx%2===0 ? "var(--lc-surface)" : "var(--lc-surface-alt, #f8fafc)";
                  const tdSticky = (left) => ({
                    position:"sticky",left,zIndex:1,background:stickyBg,
                    boxShadow: left>0 ? "inset -1px 0 0 var(--lc-border-soft)" : undefined,
                  });
                  return <TR key={e._id}>
                    <TD style={tdSticky(0)}><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 6px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                    <TD bold style={tdSticky(95)}>{e.nom} {e.prenom}</TD>
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
