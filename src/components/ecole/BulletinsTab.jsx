import React from "react";
import { C } from "../../constants";
import { Badge, Btn, Card, Modale, TD, Textarea, THead, TR, Vide } from "../ui";
import { imprimerBulletin, imprimerBulletinsGroupes, imprimerFicheCompositions } from "../../reports";
import { getGeneralAverage } from "../../note-utils";

export function BulletinsTab({
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
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const elevesB = elevesFiltres.filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Bulletins de notes</strong>
        <input placeholder="🔍 Recherche par matricule..."
          value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
        <select value={periodeB} onChange={e=>setPeriodeB(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          <option>T1</option><option>T2</option><option>T3</option>
        </select>
        <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          <option value="all">Toutes les classes</option>
          {classesUniq.map(c=><option key={c}>{c}</option>)}
        </select>
        <Btn v="success" onClick={()=>{
          const elevesC=(filtreClasse==="all"?elevesFiltres:elevesFiltres.filter(e=>e.classe===filtreClasse))
            .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
          imprimerFicheCompositions(filtreClasse,periodeB,notes,matieres,elevesC,maxNote,schoolInfo);
        }}>
          🏆 Résultats des évaluations
        </Btn>
        <Btn v="vert" onClick={()=>{
          const elevesBtn=elevesFiltres
            .filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()))
            .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
          imprimerBulletinsGroupes(elevesBtn,notes,matieres,periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,filtreClasse==="all"?"Toutes classes":filtreClasse,matieresForClasse,appreciationsParEleveB(periodeB));
        }}>
          📄 Tous les bulletins {filtreClasse!=="all"?`— ${filtreClasse}`:""}
        </Btn>
      </div>
      {elevesB.length===0?<Vide icone="📊" msg="Aucun élève pour cette sélection"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Matricule","Élève","Classe","Moy. Générale","Mention","Appréciation","Bulletin"]}/>
          <tbody>{elevesB.map(e=>{
            const notesE=notes.filter(n=>n.eleveId===e._id&&n.periode===periodeB);
            const moyenneGenerale = getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe);
            const moyGene=moyenneGenerale!=null?moyenneGenerale.toFixed(2):"—";
            const mention=moyGene==="—"?"—":Number(moyGene)>=16?"Très Bien":Number(moyGene)>=14?"Bien":Number(moyGene)>=12?"Assez Bien":Number(moyGene)>=10?"Passable":"Insuffisant";
            const eleveImpayeBloq = !!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0;
            const apprec=getAppreciation(e._id,periodeB);
            const apprecTexte=apprec?.texte||"";
            return <TR key={e._id}>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
              <TD bold>{e.nom} {e.prenom}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD><span style={{fontWeight:800,fontSize:14,color:moyGene!=="—"&&Number(moyGene)>=10?C.greenDk:"#b91c1c"}}>{moyGene}/20</span></TD>
              <TD><Badge color={mention==="Très Bien"||mention==="Bien"?"vert":mention==="Assez Bien"||mention==="Passable"?"blue":"red"}>{mention}</Badge></TD>
              <TD>
                {(canCreate||canEdit)
                  ? <Btn sm v={apprecTexte?"vert":"ghost"} title={apprecTexte||"Ajouter une appréciation"} onClick={()=>{setForm({eleveId:e._id,nomComplet:`${e.nom} ${e.prenom}`,texte:apprecTexte});setModal("apprec");}}>
                      {apprecTexte?"✏️ Modifier":"➕ Saisir"}
                    </Btn>
                  : (apprecTexte
                      ? <span title={apprecTexte} style={{fontSize:11,color:"#374151",fontStyle:"italic",display:"inline-block",maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{apprecTexte}</span>
                      : <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>—</span>)
                }
              </TD>
              <TD>{eleveImpayeBloq
                ? <span title="Frais impayés — impression bloquée" style={{fontSize:18}}>🔒</span>
                : <Btn sm v="amber" onClick={()=>imprimerBulletin(e,notes,matieresForClasse(e.classe),periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,{allEleves:eleves,allNotes:notes,appreciation:apprecTexte})}>🖨️ Imprimer</Btn>
              }</TD>
            </TR>;
          })}</tbody>
        </table></Card>}

      {modal==="apprec"&&(canCreate||canEdit)&&<Modale titre={`Appréciation — ${form.nomComplet||""} · ${periodeB}`} fermer={()=>setModal(null)}>
        <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark}}>
          Saisissez l'appréciation du conseil de classe pour cet élève. Elle apparaîtra sur le bulletin imprimé.
        </div>
        <Textarea label="Appréciation" rows={4} value={form.texte||""} onChange={chg("texte")} placeholder="Ex : Trimestre satisfaisant. Doit poursuivre ses efforts en mathématiques." maxLength={500}/>
        <div style={{fontSize:11,color:"#6b7280",marginTop:4,textAlign:"right"}}>{(form.texte||"").length} / 500</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14}}>
          <div>
            {getAppreciation(form.eleveId,periodeB)?.texte && (
              <Btn v="ghost" sm onClick={async()=>{
                if(!confirm("Effacer l'appréciation ?"))return;
                await saveAppreciation(form.eleveId,periodeB,"");
                setModal(null);
              }}>🗑 Effacer</Btn>
            )}
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={async()=>{
              await saveAppreciation(form.eleveId,periodeB,form.texte||"");
              setModal(null);
            }}>✅ Enregistrer</Btn>
          </div>
        </div>
      </Modale>}
    </div>
  );
}
