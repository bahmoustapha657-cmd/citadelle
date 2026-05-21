import React from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Badge, Btn, Card, Modale, TD, Textarea, TR, Vide } from "../ui";
import { imprimerBulletin, imprimerBulletinsGroupes, imprimerFicheCompositions } from "../../reports";
import { getGeneralAverage } from "../../note-utils";

export function BulletinsTab({
  periodes = ["T1", "T2", "T3"],
  rechercheMatricule,
  setRechercheMatricule,
  periodeB,
  setPeriodeB,
  filtreClasse,
  setFiltreClasse,
  classesUniq,
  elevesFiltres,
  eleves,
  notes,
  matieres,
  matieresForClasse,
  schoolInfo,
  moisAnnee,
  maxNote,
  avecEns,
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  getAppreciation,
  saveAppreciation,
  appreciationsParEleveB,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const elevesB = elevesFiltres.filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("school.bulletins.title")}</strong>
        <input placeholder={t("school.bulletins.searchByMatricule")}
          value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
        <select value={periodeB} onChange={e=>setPeriodeB(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          {periodes.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          <option value="all">{t("common.all")}</option>
          {classesUniq.map(c=><option key={c}>{c}</option>)}
        </select>
        <Btn v="success" onClick={()=>{
          const elevesC=(filtreClasse==="all"?elevesFiltres:elevesFiltres.filter(e=>e.classe===filtreClasse))
            .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
          imprimerFicheCompositions(filtreClasse,periodeB,notes,matieres,elevesC,maxNote,schoolInfo);
        }}>
          {t("school.bulletins.evaluationResults")}
        </Btn>
        <Btn v="vert" onClick={()=>{
          const elevesBtn=elevesFiltres
            .filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()))
            .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
          imprimerBulletinsGroupes(elevesBtn,notes,matieres,periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,filtreClasse==="all"?"Toutes classes":filtreClasse,matieresForClasse,appreciationsParEleveB(periodeB));
        }}>
          {t("school.bulletins.allBulletins")} {filtreClasse!=="all"?`— ${filtreClasse}`:""}
        </Btn>
      </div>
      {elevesB.length===0?<Vide icone="📊" msg={t("school.bulletins.noStudent")}/>
        :<Card><div style={{maxHeight:"calc(100vh - 320px)",minHeight:280,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:0}}>
            {(()=>{
              const cols = [t("school.bulletins.matricule"),t("school.bulletins.student"),t("school.bulletins.class"),t("school.bulletins.average"),t("school.bulletins.mention"),t("school.bulletins.appreciation"),t("school.bulletins.bulletin")];
              const thBase = {textAlign:"start",padding:"10px 13px",fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.9)",textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap",borderBottom:"2px solid var(--sc2)",background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))",position:"sticky",top:0};
              return (
                <thead>
                  <tr>
                    <th style={{...thBase,left:0,zIndex:4}}>{cols[0]}</th>
                    <th style={{...thBase,left:95,zIndex:4}}>{cols[1]}</th>
                    {cols.slice(2).map((c,i)=>(<th key={i} style={{...thBase,zIndex:3}}>{c}</th>))}
                  </tr>
                </thead>
              );
            })()}
          <tbody>{elevesB.map((e,rowIdx)=>{
            const notesE=notes.filter(n=>n.eleveId===e._id&&n.periode===periodeB);
            const moyenneGenerale = getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe);
            const moyGene=moyenneGenerale!=null?moyenneGenerale.toFixed(2):"—";
            const mention=moyGene==="—"?"—":Number(moyGene)>=16?"Très Bien":Number(moyGene)>=14?"Bien":Number(moyGene)>=12?"Assez Bien":Number(moyGene)>=10?"Passable":"Insuffisant";
            const eleveImpayeBloq = !!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0;
            const apprec=getAppreciation(e._id,periodeB);
            const apprecTexte=apprec?.texte||"";
            // Background sticky alterné pour préserver le zébrage
            const stickyBg = rowIdx%2===0 ? "var(--lc-surface)" : "var(--lc-surface-alt, #f8fafc)";
            return <TR key={e._id}>
              <TD style={{position:"sticky",left:0,zIndex:1,background:stickyBg}}><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
              <TD bold style={{position:"sticky",left:95,zIndex:1,background:stickyBg,boxShadow:"inset -1px 0 0 var(--lc-border-soft)"}}>{e.nom} {e.prenom}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD><span style={{fontWeight:800,fontSize:14,color:moyGene!=="—"&&Number(moyGene)>=10?C.greenDk:"#b91c1c"}}>{moyGene}/20</span></TD>
              <TD><Badge color={mention==="Très Bien"||mention==="Bien"?"vert":mention==="Assez Bien"||mention==="Passable"?"blue":"red"}>{mention}</Badge></TD>
              <TD>
                {(canCreate||canEdit)
                  ? <Btn sm v={apprecTexte?"vert":"ghost"} title={apprecTexte||t("school.bulletins.addAppreciation")} onClick={()=>{setForm({eleveId:e._id,nomComplet:`${e.nom} ${e.prenom}`,texte:apprecTexte});setModal("apprec");}}>
                      {apprecTexte?t("school.bulletins.editAppreciation"):t("school.bulletins.addAppreciation")}
                    </Btn>
                  : (apprecTexte
                      ? <span title={apprecTexte} style={{fontSize:11,color:"#374151",fontStyle:"italic",display:"inline-block",maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{apprecTexte}</span>
                      : <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>—</span>)
                }
              </TD>
              <TD>{eleveImpayeBloq
                ? <span title="Frais impayés — impression bloquée" style={{fontSize:18}}>🔒</span>
                : <Btn sm v="amber" onClick={()=>imprimerBulletin(e,notes,matieresForClasse(e.classe),periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,{allEleves:eleves,allNotes:notes,appreciation:apprecTexte})}>{t("school.bulletins.printBulletin")}</Btn>
              }</TD>
            </TR>;
          })}</tbody>
          </table>
        </div></Card>}

      {modal==="apprec"&&(canCreate||canEdit)&&<Modale titre={`${t("school.bulletins.appreciation")} — ${form.nomComplet||""} · ${periodeB}`} fermer={()=>setModal(null)}>
        <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark}}>
          {t("school.bulletins.appreciationHelp")}
        </div>
        <Textarea label={t("school.bulletins.appreciation")} rows={4} value={form.texte||""} onChange={chg("texte")} placeholder="Ex : Trimestre satisfaisant. Doit poursuivre ses efforts en mathématiques." maxLength={500}/>
        <div style={{fontSize:11,color:"#6b7280",marginTop:4,textAlign:"right"}}>{(form.texte||"").length} / 500</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14}}>
          <div>
            {getAppreciation(form.eleveId,periodeB)?.texte && (
              <Btn v="ghost" sm onClick={async()=>{
                if(!confirm(t("school.bulletins.clearConfirm")))return;
                await saveAppreciation(form.eleveId,periodeB,"");
                setModal(null);
              }}>{t("school.bulletins.clearAppreciation")}</Btn>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>{t("common.cancel")}</Btn>
            <Btn onClick={async()=>{
              await saveAppreciation(form.eleveId,periodeB,form.texte||"");
              setModal(null);
            }}>✅ {t("common.save")}</Btn>
          </div>
        </div>
      </Modale>}
    </div>
  );
}
