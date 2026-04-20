import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import { Badge, Btn, Card, Input, LectureSeule, Modale, Selec, Stat, TD, THead, TR, Tabs, Vide } from "./ui";

//  PORTAIL ENSEIGNANT
// ══════════════════════════════════════════════════════════════
function PortailEnseignant({utilisateur, deconnecter, annee, schoolInfo}) {
  const {moisAnnee, toast} = useContext(SchoolContext);
  const nomEns = utilisateur.enseignantNom || utilisateur.nom || "";
  const sec     = utilisateur.section || "college";
  const matiere = utilisateur.matiere || "";

  const cleEmplois = sec==="lycee"?"classesLycee_emplois":sec==="primaire"?"classesPrimaire_emplois":"classesCollege_emplois";
  const cleNotes   = sec==="lycee"?"notesLycee":sec==="primaire"?"notesPrimaire":"notesCollege";
  const cleEleves  = sec==="lycee"?"elevesLycee":sec==="primaire"?"elevesPrimaire":"elevesCollege";
  const cleEng     = sec==="primaire"?null:sec==="lycee"?"ensLycee_enseignements":"ensCollege_enseignements";

  const {items:emplois}                                            = useFirestore(cleEmplois);
  const {items:notes,  ajouter:ajNote, modifier:modNote}          = useFirestore(cleNotes);
  const {items:eleves}                                             = useFirestore(cleEleves);
  const {items:absences}                                           = useFirestore(cleEng||"__none__");
  const {items:salaires}                                           = useFirestore("salaires");

  const [tab,setTab] = useState("dashboard");
  const [periodeN,setPeriodeN] = useState(moisAnnee[0]||"");
  const [modalNote,setModalNote] = useState(null);
  const [formNote,setFormNote] = useState({});

  // Données filtrées
  const mesEmplois  = emplois.filter(e=>(e.enseignant||"").toLowerCase()===nomEns.toLowerCase());
  const mesClasses  = [...new Set(mesEmplois.map(e=>e.classe||""))].filter(Boolean);
  const mesEleves   = eleves.filter(e=>mesClasses.includes(e.classe));
  const mesNotes    = notes.filter(n=>(n.matiere||"")===(matiere||n.matiere));
  const mesAbsences = absences.filter(a=>(a.enseignantNom||"").toLowerCase()===nomEns.toLowerCase());
  const monSalaire  = salaires.filter(s=>(s.nom||"").toLowerCase().trim()===nomEns.toLowerCase().trim());

  const c1 = schoolInfo.couleur1||C.blue;
  const c2 = schoolInfo.couleur2||C.green;

  const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const HEURES = ["07h-08h","08h-09h","09h-10h","10h-11h","11h-12h","14h-15h","15h-16h","16h-17h","17h-18h"];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',sans-serif"}}>
      <GlobalStyles/>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${c1},${c1}ee)`,padding:"14px 24px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
        {schoolInfo.logo&&<img src={schoolInfo.logo} alt="logo" style={{width:38,height:38,objectFit:"contain",borderRadius:8,background:"rgba(255,255,255,0.15)",padding:4}}/>}
        <div style={{flex:1}}>
          <div style={{color:c2,fontWeight:900,fontSize:15}}>{schoolInfo.nom||"École"}</div>
          <div style={{color:"rgba(255,255,255,0.7)",fontSize:11}}>Portail Enseignant · {annee}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{nomEns}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
            <Badge color="purple">{matiere||"Enseignant"}</Badge>
            <button onClick={deconnecter} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",padding:"3px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontWeight:700}}>Déconnexion</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:"2px solid #e2e8f0",padding:"0 24px",display:"flex",gap:0,overflowX:"auto"}}>
        {[
          {id:"dashboard",icon:"🏠",label:"Tableau de bord"},
          {id:"edt",      icon:"📅",label:"Mon EDT"},
          {id:"notes",    icon:"📝",label:"Saisie notes"},
          {id:"eleves",   icon:"👥",label:"Mes élèves"},
          {id:"absences", icon:"📋",label:"Mes absences"},
          {id:"salaire",  icon:"💰",label:"Ma fiche de paie"},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"13px 18px",border:"none",background:"none",cursor:"pointer",
            fontSize:13,fontWeight:700,whiteSpace:"nowrap",
            color:tab===t.id?c1:"#64748b",
            borderBottom:tab===t.id?`3px solid ${c1}`:"3px solid transparent",
            transition:"all .15s",
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div style={{padding:"24px",maxWidth:1100,margin:"0 auto"}}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&<>
          <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:900,color:c1}}>Bonjour, {nomEns.split(" ")[0]} 👋</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
            <Stat label="Mes classes"       value={mesClasses.length} sub={mesClasses.join(", ")||"—"} bg="#f0f7ff"/>
            <Stat label="Mes élèves"        value={mesEleves.length}  sub="ce niveau"                   bg="#f0fdf4"/>
            <Stat label="Notes saisies"     value={mesNotes.length}   sub={matiere}                     bg="#fefce8"/>
            <Stat label="Créneaux / semaine" value={mesEmplois.length} sub="heures de cours"            bg="#fdf4ff"/>
            <Stat label="Absences"          value={mesAbsences.filter(a=>a.statut==="Absent").length} sub="ce mois" bg="#fff1f2"/>
          </div>

          {/* Planning du jour (aujourd'hui) */}
          {mesEmplois.length>0&&<Card style={{marginBottom:20}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9"}}>
              <strong style={{fontSize:13,color:c1}}>📅 Mon emploi du temps</strong>
            </div>
            <div style={{padding:"12px 18px",display:"flex",flexWrap:"wrap",gap:8}}>
              {mesEmplois.map((e,i)=>(
                <div key={i} style={{background:`${c1}11`,borderLeft:`3px solid ${c1}`,borderRadius:"0 8px 8px 0",padding:"8px 12px",minWidth:130}}>
                  <div style={{fontSize:11,fontWeight:700,color:c1}}>{e.jour} — {e.heure}</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#374151",marginTop:2}}>{e.classe}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>{e.matiere||matiere}</div>
                </div>
              ))}
            </div>
          </Card>}

          {/* Dernières notes saisies */}
          {mesNotes.length>0&&<Card>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9"}}>
              <strong style={{fontSize:13,color:c1}}>📝 Dernières notes saisies</strong>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <THead cols={["Élève","Matière","Type","Période","Note"]}/>
                <tbody>{mesNotes.slice(-10).reverse().map((n,i)=>(
                  <TR key={i}>
                    <TD bold>{n.eleveNom}</TD>
                    <TD>{n.matiere}</TD>
                    <TD><Badge color="blue">{n.type}</Badge></TD>
                    <TD>{n.periode}</TD>
                    <TD center><strong style={{color:Number(n.note)>=10?C.greenDk:"#b91c1c"}}>{n.note}/20</strong></TD>
                  </TR>
                ))}</tbody>
              </table>
            </div>
          </Card>}
        </>}

        {/* ── EMPLOI DU TEMPS ── */}
        {tab==="edt"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:900,color:c1}}>Mon emploi du temps</h2>
            {mesEmplois.length>0&&<Btn sm v="ghost" onClick={()=>{
              const w=window.open("","_blank");
              const rows=HEURES.map(h=>`<tr><td style="font-weight:700;background:#f8fafc;white-space:nowrap">${h}</td>${JOURS.map(j=>{const c=mesEmplois.find(e=>e.heure===h&&e.jour===j);return`<td style="text-align:center;padding:6px">${c?`<div style="background:#e8f0fe;border-radius:4px;padding:4px 6px;font-size:11px"><strong>${c.classe}</strong><br/>${c.matiere||matiere}</div>`:""}</td>`;}).join("")}</tr>`).join("");
              w.document.write(`<!DOCTYPE html><html><head><title>EDT — ${nomEns}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0dce8;padding:8px 10px;font-size:12px}th{background:#0A1628;color:#fff}@media print{button{display:none}}</style></head><body><h2 style="color:#0A1628">Emploi du temps — ${nomEns}</h2><p style="color:#555">${matiere} · ${schoolInfo.nom} · ${annee}</p><table><tr><th>Heure</th>${JOURS.map(j=>`<th>${j}</th>`).join("")}</tr>${rows}</table><br/><button onclick="window.print()">Imprimer</button></body></html>`);
              w.document.close();
            }}>🖨️ Imprimer EDT</Btn>}
          </div>
          {mesEmplois.length===0
            ?<Vide icone="📅" msg="Aucun créneau dans votre emploi du temps"/>
            :<Card>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                  <THead cols={["Heure",...JOURS]}/>
                  <tbody>{HEURES.map(h=>(
                    <TR key={h}>
                      <TD bold style={{background:"#f8fafc",whiteSpace:"nowrap",fontSize:11}}>{h}</TD>
                      {JOURS.map(j=>{
                        const c=mesEmplois.find(e=>e.heure===h&&e.jour===j);
                        return <td key={j} style={{padding:"6px 10px",border:"1px solid #f1f5f9",textAlign:"center"}}>
                          {c?<div style={{background:`${c1}15`,borderRadius:6,padding:"4px 8px",border:`1px solid ${c1}33`}}>
                            <div style={{fontSize:11,fontWeight:800,color:c1}}>{c.classe}</div>
                            <div style={{fontSize:10,color:"#64748b"}}>{c.matiere||matiere}</div>
                          </div>:null}
                        </td>;
                      })}
                    </TR>
                  ))}</tbody>
                </table>
              </div>
            </Card>}
        </>}

        {/* ── SAISIE NOTES ── */}
        {tab==="notes"&&<>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:900,color:c1,flex:1}}>Saisie des notes — {matiere}</h2>
            <select value={periodeN} onChange={e=>setPeriodeN(e.target.value)}
              style={{border:"1.5px solid #e2e8f0",borderRadius:8,padding:"7px 12px",fontSize:13,background:"#fff"}}>
              {moisAnnee.map(m=><option key={m}>{m}</option>)}
            </select>
            <Btn onClick={()=>{setFormNote({matiere,periode:periodeN,type:"Devoir"});setModalNote("add");}}>+ Nouvelle note</Btn>
          </div>
          {mesNotes.filter(n=>n.periode===periodeN).length===0
            ?<Vide icone="📝" msg={`Aucune note pour ${periodeN}`}/>
            :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Élève","Type","Note /20","Actions"]}/>
              <tbody>{mesNotes.filter(n=>n.periode===periodeN).map(n=>(
                <TR key={n._id}>
                  <TD bold>{n.eleveNom}</TD>
                  <TD><Badge color="blue">{n.type}</Badge></TD>
                  <TD center><strong style={{fontSize:14,color:Number(n.note)>=10?C.greenDk:"#b91c1c"}}>{n.note}</strong></TD>
                  <TD center>
                    <Btn sm v="ghost" onClick={()=>{setFormNote({...n});setModalNote("edit");}}>✏️</Btn>
                    <Btn sm v="danger" onClick={()=>confirm("Supprimer ?")&&notes.find(x=>x._id===n._id)&&modNote({...n,note:n.note})}>🗑</Btn>
                  </TD>
                </TR>
              ))}</tbody>
            </table></Card>}

          {modalNote&&<Modale titre={modalNote==="add"?"Nouvelle note":"Modifier la note"} fermer={()=>setModalNote(null)}>
            <Selec label="Élève" value={formNote.eleveId||""} onChange={e=>{
              const el=mesEleves.find(x=>x._id===e.target.value);
              setFormNote(p=>({...p,eleveId:e.target.value,eleveNom:el?`${el.nom} ${el.prenom}`:p.eleveNom}));
            }}>
              <option value="">— Choisir un élève —</option>
              {mesEleves.map(e=><option key={e._id} value={e._id}>{e.nom} {e.prenom} ({e.classe})</option>)}
            </Selec>
            <div style={{height:10}}/>
            <Selec label="Type" value={formNote.type||"Devoir"} onChange={e=>setFormNote(p=>({...p,type:e.target.value}))}>
              <option>Devoir</option><option>Composition</option><option>Interrogation</option>
            </Selec>
            <div style={{height:10}}/>
            <Input label="Note /20" type="number" value={formNote.note||""} onChange={e=>setFormNote(p=>({...p,note:e.target.value}))} placeholder="Ex : 14"/>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <Btn v="ghost" onClick={()=>setModalNote(null)}>Annuler</Btn>
              <Btn onClick={()=>{
                if(!formNote.eleveId||formNote.note===""){toast("Élève et note requis.","warning");return;}
                const data={...formNote,note:Number(formNote.note),matiere,periode:periodeN};
                if(modalNote==="add") ajNote(data); else modNote(data);
                setModalNote(null);
              }}>Enregistrer</Btn>
            </div>
          </Modale>}
        </>}

        {/* ── MES ÉLÈVES ── */}
        {tab==="eleves"&&<>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:900,color:c1}}>Mes élèves ({mesEleves.length})</h2>
          {mesClasses.length===0
            ?<Vide icone="👥" msg="Aucune classe assignée dans l'emploi du temps"/>
            :<>
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                {mesClasses.map(c=><Badge key={c} color="blue">{c} — {mesEleves.filter(e=>e.classe===c).length} élève(s)</Badge>)}
              </div>
              <Card><table style={{width:"100%",borderCollapse:"collapse"}}>
                <THead cols={["Matricule","Nom & Prénom","Classe","Sexe","Statut"]}/>
                <tbody>{mesEleves.map(e=>(
                  <TR key={e._id}>
                    <TD><span style={{fontFamily:"monospace",fontSize:11,background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:c1,fontWeight:700}}>{e.matricule}</span></TD>
                    <TD bold>{e.nom} {e.prenom}</TD>
                    <TD><Badge color="blue">{e.classe}</Badge></TD>
                    <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
                    <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut||"Actif"}</Badge></TD>
                  </TR>
                ))}</tbody>
              </table></Card>
            </>}
        </>}

        {/* ── ABSENCES ── */}
        {tab==="absences"&&<>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:900,color:c1}}>Mes absences & engagements</h2>
          {mesAbsences.length===0
            ?<Vide icone="📋" msg="Aucune absence enregistrée"/>
            :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Date","Classe","Matière","Statut","Motif"]}/>
              <tbody>{mesAbsences.map((a,i)=>(
                <TR key={i}>
                  <TD>{a.date||"—"}</TD>
                  <TD><Badge color="blue">{a.classe||"—"}</Badge></TD>
                  <TD>{a.matiere||matiere}</TD>
                  <TD><Badge color={a.statut==="Absent"?"red":a.statut==="Non effectué"?"amber":"vert"}>{a.statut}</Badge></TD>
                  <TD>{a.motif||"—"}</TD>
                </TR>
              ))}</tbody>
            </table></Card>}
        </>}

        {/* ── FICHE DE PAIE ── */}
        {tab==="salaire"&&<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <h2 style={{margin:0,fontSize:16,fontWeight:900,color:c1}}>Ma fiche de paie</h2>
            {monSalaire.length>0&&<Btn sm v="ghost" onClick={()=>{
              const w=window.open("","_blank");
              const lignes=monSalaire.map(s=>{
                const net=s.section==="Secondaire"
                  ?((Number(s.vhPrevu||0)+Number(s.cinqSem||0)-Number(s.nonExecute||0))*Number(s.primeHoraire||0)-Number(s.bon||0)+Number(s.revision||0))
                  :(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0));
                return `<tr><td>${s.mois}</td><td>${s.section}</td><td>${s.section==="Secondaire"?`${(Number(s.vhPrevu||0)+Number(s.cinqSem||0)-Number(s.nonExecute||0))} h × ${(s.primeHoraire||0).toLocaleString("fr-FR")} GNF`:`Forfait ${Number(s.montantForfait||0).toLocaleString("fr-FR")} GNF`}</td><td>${Number(s.bon||0)>0?"-"+Number(s.bon).toLocaleString("fr-FR"):"-"}</td><td>${Number(s.revision||0)>0?"+"+Number(s.revision).toLocaleString("fr-FR"):"-"}</td><td style="font-weight:900;color:#0A1628">${net.toLocaleString("fr-FR")} GNF</td></tr>`;
              }).join("");
              w.document.write(`<!DOCTYPE html><html><head><title>Fiches de paie — ${nomEns}</title><style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px}h2{color:#0A1628}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0A1628;color:#fff;padding:8px 10px}td{padding:8px 10px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style></head><body><h2>${schoolInfo.nom||"École"} — Fiches de paie</h2><p>${nomEns} · ${matiere||"Enseignant"} · Année ${annee}</p><table><tr><th>Mois</th><th>Section</th><th>Détail</th><th>Bon</th><th>Révision</th><th>Net à payer</th></tr>${lignes}</table><br/><button onclick="window.print()">🖨️ Imprimer</button></body></html>`);
              w.document.close();
            }}>🖨️ Imprimer fiches</Btn>}
          </div>
          <LectureSeule/>
          {monSalaire.length===0
            ?<Vide icone="💰" msg="Aucune fiche de paie disponible"/>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {monSalaire.map((s,i)=>{
                const net=s.section==="Secondaire"
                  ?((Number(s.vhPrevu||0)+Number(s.cinqSem||0)-Number(s.nonExecute||0))*Number(s.primeHoraire||0)-Number(s.bon||0)+Number(s.revision||0))
                  :(Number(s.montantForfait||0)-Number(s.bon||0)+Number(s.revision||0));
                return (
                  <Card key={i} style={{padding:0}}>
                    <div style={{background:`linear-gradient(135deg,${c1},${c1}cc)`,padding:"12px 16px",borderRadius:"14px 14px 0 0"}}>
                      <div style={{color:c2,fontWeight:900,fontSize:13}}>{s.mois}</div>
                      <div style={{color:"rgba(255,255,255,0.7)",fontSize:11}}>Section {s.section}</div>
                    </div>
                    <div style={{padding:"14px 16px"}}>
                      {s.section==="Secondaire"?<>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,paddingBottom:6,borderBottom:"1px solid #f1f5f9"}}>
                          <span style={{color:"#64748b"}}>V.H. exécuté</span>
                          <strong>{(Number(s.vhPrevu||0)+Number(s.cinqSem||0)-Number(s.nonExecute||0))} h</strong>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                          <span style={{color:"#64748b"}}>Prime horaire</span>
                          <strong>{(s.primeHoraire||0).toLocaleString("fr-FR")} GNF</strong>
                        </div>
                      </>:<>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,paddingBottom:6,borderBottom:"1px solid #f1f5f9"}}>
                          <span style={{color:"#64748b"}}>Forfait</span>
                          <strong>{Number(s.montantForfait||0).toLocaleString("fr-FR")} GNF</strong>
                        </div>
                      </>}
                      {Number(s.bon||0)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,color:"#b91c1c"}}>
                        <span>Bon déduit</span>
                        <strong>-{Number(s.bon).toLocaleString("fr-FR")} GNF</strong>
                      </div>}
                      {Number(s.revision||0)>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6,color:C.greenDk}}>
                        <span>Révision</span>
                        <strong>+{Number(s.revision).toLocaleString("fr-FR")} GNF</strong>
                      </div>}
                      <div style={{display:"flex",justifyContent:"space-between",padding:"10px 12px",background:`${c1}0d`,borderRadius:8,marginTop:8}}>
                        <span style={{fontWeight:700,fontSize:13,color:c1}}>NET À PAYER</span>
                        <strong style={{fontSize:15,color:c1}}>{net.toLocaleString("fr-FR")} GNF</strong>
                      </div>
                      {s.observation&&<p style={{fontSize:11,color:"#94a3b8",marginTop:8}}>{s.observation}</p>}
                    </div>
                  </Card>
                );
              })}
            </div>}
        </>}

      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PORTAIL PARENT
// ══════════════════════════════════════════════════════════════
// ── Écran de blocage accès parent (impayés) ──────────────────

export { PortailEnseignant };
