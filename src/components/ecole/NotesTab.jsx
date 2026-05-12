import React from "react";
import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, THead, TR, Vide } from "../ui";
import { exportExcel } from "../../reports";
import { getEvaluationLabel, resolveCanonicalNoteType } from "../../evaluation-forms";

const loadXLSX = () => import("xlsx");

export function NotesTab({
  notes,
  cN,
  ajN,
  supN,
  eleves,
  matieres,
  matieresForClasse,
  noteForms,
  defaultNoteType,
  schoolInfo,
  isPrimarySection,
  avecEns,
  maxNote,
  readOnly,
  canCreate,
  canEdit,
  form,
  setForm,
  modal,
  setModal,
  notesVue,
  setNotesVue,
  grilleClasse,
  setGrilleClasse,
  grillePeriode,
  setGrillePeriode,
  grilleType,
  setGrilleType,
  grilleChanges,
  setGrilleChanges,
  grilleSaving,
  setGrilleSaving,
  importPreview,
  setImportPreview,
  importEnCours,
  setImportEnCours,
  toast,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Notes ({notes.length})</strong>
        {/* Toggle vue */}
        <div style={{display:"flex",background:"#f1f5f9",borderRadius:8,padding:3,gap:2}}>
          {[{v:"liste",icon:"☰"},{v:"grille",icon:"⊞"}].map(({v,icon})=>(
            <button key={v} onClick={()=>setNotesVue(v)} style={{
              padding:"4px 10px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
              background:notesVue===v?"#fff":"transparent",color:notesVue===v?C.blueDark:"#94a3b8",
              boxShadow:notesVue===v?"0 1px 3px rgba(0,0,0,0.1)":"none",
            }}>{icon}</button>
          ))}
        </div>
        <Btn sm v="ghost" onClick={()=>exportExcel(
          `Notes_${avecEns?"College":"Primaire"}`,
          ["Élève","Matière","Type","Période",`Note /${maxNote}`],
          notes.map(n=>[n.eleveNom,n.matiere,getEvaluationLabel(n.type, schoolInfo, { section: isPrimarySection ? "primaire" : "secondaire" }),n.periode,n.note])
        )}>📥 Export</Btn>
        <Btn sm v="ghost" onClick={()=>exportExcel(`Modele_Notes`,
          ["Élève (Nom Prénom)","Matière","Type","Période",`Note (/${maxNote})`],
          eleves.slice(0,3).map(e=>[`${e.nom} ${e.prenom}`,matieres[0]?.nom||"Maths",noteForms[0]?.label||"Devoir","T1",Math.round(maxNote*0.7)])
        )}>📋 Modèle</Btn>
        {canCreate&&<Btn sm v="vert" onClick={()=>setModal("import_notes")}>⬆️ Importer</Btn>}
        {canCreate&&<Btn onClick={()=>{setForm({periode:"T1",type:defaultNoteType});setModal("add_n");}}>+ Saisir</Btn>}
      </div>

      {/* ── VUE GRILLE ── */}
      {notesVue==="grille"&&(()=>{
        const classesUniqN = [...new Set(eleves.map(e=>e.classe||""))].filter(Boolean).sort();
        const elevesGrille = (grilleClasse==="all"?eleves:eleves.filter(e=>e.classe===grilleClasse))
          .filter(e=>e.statut==="Actif"||!e.statut)
          .sort((a,b)=>(a.nom+a.prenom).localeCompare(b.nom+b.prenom));
        const matieresCols = matieresForClasse(grilleClasse==="all"?null:grilleClasse).map(m=>m.nom);

        const getNoteExist = (eleveId, mat) =>
          notes.find(n=>(n.eleveId===eleveId||n.eleveNom)&&n.matiere===mat&&n.periode===grillePeriode&&n.type===grilleType);

        const valeurCellule = (eleveId, mat) => {
          const key = `${eleveId}|${mat}`;
          if(key in grilleChanges) return grilleChanges[key];
          return getNoteExist(eleveId, mat)?.note ?? "";
        };

        const couleurNote = (v) => {
          const n = Number(v);
          if(v===""||isNaN(n)) return {};
          if(n >= maxNote*0.7) return {background:"#dcfce7",color:"#166534"};
          if(n >= maxNote*0.5) return {background:"#fef3c7",color:"#92400e"};
          return {background:"#fee2e2",color:"#991b1b"};
        };

        const sauvegarderGrille = async() => {
          if(!Object.keys(grilleChanges).length){toast("Aucune modification.","info");return;}
          setGrilleSaving(true);
          let nb=0;
          for(const [key,val] of Object.entries(grilleChanges)){
            const [eleveId, ...matParts] = key.split("|");
            const mat = matParts.join("|");
            if(val===""||isNaN(Number(val))) continue;
            const exist = getNoteExist(eleveId, mat);
            const eleve = eleves.find(e=>e._id===eleveId);
            if(exist){ await ajN({...exist,note:Number(val)}); }
            else { await ajN({eleveId,eleveNom:`${eleve?.nom||""} ${eleve?.prenom||""}`.trim(),matiere:mat,type:grilleType,periode:grillePeriode,note:Number(val)}); }
            nb++;
          }
          setGrilleChanges({});
          setGrilleSaving(false);
          toast(`${nb} note(s) enregistrée(s)`,"success");
        };

        return (
          <div>
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
              <select value={grilleClasse} onChange={e=>setGrilleClasse(e.target.value)}
                style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                <option value="all">Toutes classes</option>
                {classesUniqN.map(c=><option key={c}>{c}</option>)}
              </select>
              <select value={grillePeriode} onChange={e=>setGrillePeriode(e.target.value)}
                style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                <option>T1</option><option>T2</option><option>T3</option>
              </select>
              <select value={grilleType} onChange={e=>setGrilleType(e.target.value)}
                style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                {noteForms.map(item=><option key={item.id} value={item.value}>{item.label}</option>)}
              </select>
              {Object.keys(grilleChanges).length>0&&(
                <Btn v="vert" sm disabled={grilleSaving} onClick={sauvegarderGrille}>
                  {grilleSaving?"Enregistrement…":`💾 Enregistrer (${Object.keys(grilleChanges).length} modif.)`}
                </Btn>
              )}
              {Object.keys(grilleChanges).length>0&&(
                <Btn v="ghost" sm onClick={()=>setGrilleChanges({})}>✕ Annuler</Btn>
              )}
            </div>
            {elevesGrille.length===0?<Vide icone="📝" msg="Aucun élève"/>:
            matieresCols.length===0?<Vide icone="📚" msg="Aucune matière définie"/>:
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead>
                  <tr style={{background:"linear-gradient(135deg,var(--sc1),var(--sc1-dk))"}}>
                    <th style={{padding:"8px 12px",textAlign:"left",color:"rgba(255,255,255,0.9)",fontSize:11,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap",minWidth:150}}>Élève</th>
                    {matieresCols.map(m=>(
                      <th key={m} style={{padding:"8px 10px",textAlign:"center",color:"rgba(255,255,255,0.9)",fontSize:10,fontWeight:700,textTransform:"uppercase",whiteSpace:"nowrap",borderLeft:"1px solid rgba(255,255,255,0.1)"}}>
                        {m}<div style={{fontSize:9,opacity:0.6,fontWeight:400}}>/{maxNote}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {elevesGrille.map((e,ri)=>{
                    const moy = matieresCols.reduce((s,m)=>{
                      const v=Number(valeurCellule(e._id,m));
                      return s+(isNaN(v)?0:v);
                    },0)/matieresCols.filter(m=>valeurCellule(e._id,m)!=="").length||0;
                    return (
                      <tr key={e._id} style={{background:ri%2===0?"#fff":"#f8fafc",borderBottom:"1px solid #f1f5f9"}}>
                        <td style={{padding:"6px 12px",fontSize:12,fontWeight:700,color:C.blueDark,whiteSpace:"nowrap"}}>
                          {e.nom} {e.prenom}
                          <span style={{fontSize:10,color:"#94a3b8",marginLeft:6}}>{e.classe}</span>
                          {!isNaN(moy)&&moy>0&&<span style={{marginLeft:8,fontSize:11,fontWeight:900,...couleurNote(moy)}}>{moy.toFixed(1)}</span>}
                        </td>
                        {matieresCols.map(m=>{
                          const key=`${e._id}|${m}`;
                          const val=valeurCellule(e._id,m);
                          const modif=key in grilleChanges;
                          return (
                            <td key={m} style={{padding:"4px 6px",textAlign:"center",borderLeft:"1px solid #f1f5f9"}}>
                              {canCreate
                                ?<input
                                  type="number" min="0" max={maxNote} step="0.25"
                                  value={val}
                                  onChange={ev=>setGrilleChanges(p=>({...p,[key]:ev.target.value}))}
                                  style={{
                                    width:54,textAlign:"center",border:`1.5px solid ${modif?"#f59e0b":"#e2e8f0"}`,
                                    borderRadius:6,padding:"3px 4px",fontSize:12,fontWeight:700,
                                    outline:"none",...couleurNote(val),
                                    background:modif?"#fffbeb":couleurNote(val).background||"#fff",
                                  }}
                                />
                                :<span style={{...couleurNote(val),padding:"2px 6px",borderRadius:6,fontSize:12,fontWeight:700}}>{val||"—"}</span>
                              }
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        );
      })()}
      {notesVue==="liste"&&(cN?<Chargement/>:notes.length===0?<Vide icone="📝" msg="Aucune note"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Élève","Matière","Type","Période",`Note /${maxNote}`,readOnly?"":"Action"]}/>
          <tbody>{notes.map(n=><TR key={n._id}>
            <TD bold>{n.eleveNom}</TD><TD>{n.matiere}</TD>
            <TD><Badge color="gray">{getEvaluationLabel(n.type, schoolInfo, { section: isPrimarySection ? "primaire" : "secondaire" })}</Badge></TD><TD>{n.periode}</TD>
            <TD><Badge color={n.note>=(maxNote*0.7)?"vert":n.note>=(maxNote*0.5)?"blue":"red"}>{n.note}/{maxNote}</Badge></TD>
            {canEdit&&<TD><Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supN(n._id);}}>Suppr.</Btn></TD>}
          </TR>)}</tbody>
        </table></Card>)}
      {modal==="import_notes"&&canCreate&&<Modale titre="⬆️ Importer des notes depuis Excel" fermer={()=>{setModal(null);setImportPreview(null);}} large>
        <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534"}}>
          <strong>Format attendu :</strong> colonnes <em>Élève (Nom Prénom) · Matière · Type · Période · Note</em><br/>
          Télécharge le modèle via le bouton "📋 Modèle" pour garantir le bon format.
        </div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={async e=>{
          const file = e.target.files[0];
          if(!file) return;
          const ab = await file.arrayBuffer();
          const XLSX = await loadXLSX();
          const wb = XLSX.read(ab);
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:""}).slice(1);
          const lignes = rows.filter(r=>r[0]||r[1]).map((r,i)=>{
            const eleveNom = String(r[0]||"").trim();
            const matiere  = String(r[1]||"").trim();
            const type     = resolveCanonicalNoteType(String(r[2]||(noteForms[0]?.label||"Devoir")).trim(), schoolInfo, isPrimarySection ? "primaire" : "secondaire");
            const periode  = String(r[3]||"T1").trim();
            const note     = Number(String(r[4]||"").replace(",","."));
            const eleve    = eleves.find(e=>`${e.nom} ${e.prenom}`.toLowerCase()===eleveNom.toLowerCase());
            const erreurs  = [];
            if(!eleveNom) erreurs.push("Élève manquant");
            else if(!eleve) erreurs.push("Élève introuvable");
            if(!matiere) erreurs.push("Matière manquante");
            if(isNaN(note)||note<0||note>maxNote) erreurs.push(`Note invalide (0–${maxNote})`);
            return { eleveNom, eleveId:eleve?._id, matiere, type, periode, note, erreurs, ligne:i+2 };
          });
          setImportPreview({ lignes, valides:lignes.filter(l=>!l.erreurs.length) });
        }} style={{marginBottom:12}}/>

        {importPreview&&<>
          <div style={{display:"flex",gap:12,marginBottom:10,fontSize:12}}>
            <span style={{color:"#059669",fontWeight:700}}>✅ {importPreview.valides.length} valides</span>
            <span style={{color:"#dc2626",fontWeight:700}}>❌ {importPreview.lignes.length-importPreview.valides.length} erreurs</span>
          </div>
          <div style={{maxHeight:300,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#f8fafc",position:"sticky",top:0}}>
                <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>L.</th>
                <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Élève</th>
                <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Matière</th>
                <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Type</th>
                <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Période</th>
                <th style={{padding:"6px 8px",textAlign:"center",fontSize:10,color:"#64748b"}}>Note</th>
                <th style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>Statut</th>
              </tr></thead>
              <tbody>{importPreview.lignes.map((l,i)=>(
                <tr key={i} style={{background:l.erreurs.length?"#fef2f2":"#f0fdf4",borderBottom:"1px solid #f1f5f9"}}>
                  <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10}}>{l.ligne}</td>
                  <td style={{padding:"4px 8px",fontWeight:600}}>{l.eleveNom||"—"}</td>
                  <td style={{padding:"4px 8px"}}>{l.matiere||"—"}</td>
                  <td style={{padding:"4px 8px"}}>{getEvaluationLabel(l.type, schoolInfo, { section: isPrimarySection ? "primaire" : "secondaire" })}</td>
                  <td style={{padding:"4px 8px"}}>{l.periode}</td>
                  <td style={{padding:"4px 8px",textAlign:"center",fontWeight:700}}>{isNaN(l.note)?"—":l.note}</td>
                  <td style={{padding:"4px 8px"}}>
                    {l.erreurs.length
                      ?<span style={{color:"#dc2626",fontSize:10}}>⚠️ {l.erreurs.join(", ")}</span>
                      :<span style={{color:"#059669",fontSize:10}}>✅</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>{setModal(null);setImportPreview(null);}}>Annuler</Btn>
          {importPreview?.valides.length>0&&<Btn v="vert" disabled={importEnCours} onClick={async()=>{
            setImportEnCours(true);
            let count=0;
            for(const l of importPreview.valides){
              await ajN({eleveNom:l.eleveNom,eleveId:l.eleveId,matiere:l.matiere,type:l.type,periode:l.periode,note:l.note});
              count++;
            }
            setImportEnCours(false);
            setModal(null);
            setImportPreview(null);
            toast(`${count} note(s) importée(s) avec succès`,"success");
          }}>{importEnCours?"Import en cours…":`⬆️ Importer ${importPreview.valides.length} note(s)`}</Btn>}
        </div>
      </Modale>}

      {modal==="add_n"&&canCreate&&<Modale titre="Saisir une note" fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}>
            <Selec label="Élève" value={form.eleveNom||""} onChange={e=>{
              const el=eleves.find(ev=>`${ev.nom} ${ev.prenom}`===e.target.value);
              setForm(p=>({...p,eleveNom:e.target.value,eleveId:el?._id}));
            }}>
              <option value="">— Sélectionner —</option>
              {eleves.map(e=><option key={e._id}>{e.nom} {e.prenom}</option>)}
            </Selec>
          </div>
          <Selec label="Matière" value={form.matiere||""} onChange={chg("matiere")}>
            <option value="">—</option>
            {(()=>{
              const eleveSelec=eleves.find(e=>`${e.nom} ${e.prenom}`===form.eleveNom);
              return matieresForClasse(eleveSelec?.classe).map(m=><option key={m._id}>{m.nom}</option>);
            })()}
          </Selec>
          <Selec label="Type" value={form.type||defaultNoteType} onChange={chg("type")}>
            {noteForms.map(item=><option key={item.id} value={item.value}>{item.label}</option>)}
          </Selec>
          <Input label={`Note (/${maxNote})`} type="number" min="0" max={maxNote} step="0.25" value={form.note||""} onChange={chg("note")}/>
          <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}>
            <option>T1</option><option>T2</option><option>T3</option>
          </Selec>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>{ajN({...form,type:resolveCanonicalNoteType(form.type, schoolInfo, isPrimarySection ? "primaire" : "secondaire"),note:Number(form.note)});setModal(null);}}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}
