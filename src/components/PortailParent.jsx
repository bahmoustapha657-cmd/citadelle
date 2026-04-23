import React, { useContext, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { C, fmt, getTarifAutreValue, getTarifMensuelTotal } from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { imprimerBulletin } from "../reports";
import { GlobalStyles } from "../styles";
import { BlocagePaiement } from "./BlocagePaiement";
import { Badge, Btn, Card, Champ, Input, LectureSeule, TD, THead, TR, Vide } from "./ui";

function PortailParent({utilisateur, deconnecter, annee, schoolInfo}) {
  const {toast} = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1||C.blue;
  const c2 = schoolInfo.couleur2||C.green;

  const sec     = utilisateur.section || "college";
  const eleveId = utilisateur.eleveId || null;
  const eleveNom= utilisateur.eleveNom || "";

  const cleNotes   = sec==="primaire"?"notesPrimaire":sec==="lycee"?"notesLycee":"notesCollege";
  const cleEleves  = sec==="primaire"?"elevesPrimaire":sec==="lycee"?"elevesLycee":"elevesCollege";
  const cleAbs     = cleEleves+"_absences";

  const {items:notes}    = useFirestore(cleNotes);
  const {items:eleves}   = useFirestore(cleEleves);
  const {items:absences} = useFirestore(cleAbs);
  const {items:tarifsClasses} = useFirestore("tarifs");
  const {items:msgs, ajouter:envoyerMsg} = useFirestore("messages");
  const {items:annonces} = useFirestore("annonces");

  const [tab,setTab]     = useState("dashboard");
  const [sujet,setSujet] = useState("");
  const [corps,setCorps] = useState("");
  const [envoi,setEnvoi] = useState(false);
  const {items:mensEleve} = useFirestore(cleEleves);

  const eleve      = eleves.find(e=>e._id===eleveId) || {};
  const mesNotes   = notes.filter(n=>n.eleveId===eleveId||n.eleveNom===eleveNom);
  const mesAbs     = absences.filter(a=>a.eleveId===eleveId||a.eleveNom===eleveNom);
  const mesMessages= msgs.filter(m=>m.eleveId===eleveId||m.eleveNom===eleveNom).sort((a,b)=>b.date-a.date);
  const nonLus     = mesMessages.filter(m=>m.expediteur==="ecole"&&!m.lu).length;

  const matieres = [...new Set(mesNotes.map(n=>n.matiere))];

  const envoyer = async() => {
    if(!sujet.trim()||!corps.trim()){toast("Sujet et message requis.","warning");return;}
    setEnvoi(true);
    await envoyerMsg({
      expediteur:"parent",
      expediteurNom:utilisateur.nom||"Parent",
      expediteurLogin:utilisateur.login,
      eleveId, eleveNom,
      sujet:sujet.trim(),
      corps:corps.trim(),
      lu:false,
      date:Date.now(),
    });
    setSujet(""); setCorps("");
    setEnvoi(false);
  };

  const eleveCourant = mensEleve.find(e=>e._id===eleveId)||{};
  const tarifEleve = tarifsClasses.find(t=>t.classe===eleveCourant.classe) || null;
  const montantMensuel = getTarifMensuelTotal(tarifEleve, eleveCourant.classe);
  const montantAutre = getTarifAutreValue(tarifEleve);
  const montantInscription = eleveCourant.typeInscription==="Réinscription"
    ? Number(tarifEleve?.reinscription||0)
    : Number(tarifEleve?.inscription||0);
  const moisAnneeCtx = useContext(SchoolContext).moisAnnee;

  // Blocage accès en cas d'impayé
  const blocageActif = !!schoolInfo.blocageParentImpaye;
  const moisImpayes = moisAnneeCtx.filter(m=>(eleveCourant.mens||{})[m]!=="Payé");
  const accesBloqueParPaiement = blocageActif && moisImpayes.length > 0;

  const TABS = [
    {id:"dashboard",icon:"🏠",label:"Tableau de bord"},
    {id:"notes",    icon:"📝",label:"Notes",     bloque:accesBloqueParPaiement},
    {id:"absences", icon:"📋",label:"Absences"},
    {id:"bulletins",icon:"📄",label:"Bulletins", bloque:accesBloqueParPaiement},
    {id:"paiements",icon:"💳",label:"Paiements"},
    {id:"messages", icon:"💬",label:"Messages"+(nonLus>0?` (${nonLus})`:"")},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter','Segoe UI',sans-serif"}}>
      <GlobalStyles/>
      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${c1},${c1}ee)`,padding:"14px 24px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
        {schoolInfo.logo&&<img src={schoolInfo.logo} alt="logo" style={{width:38,height:38,objectFit:"contain",borderRadius:8,background:"rgba(255,255,255,0.15)",padding:4}}/>}
        <div style={{flex:1}}>
          <div style={{color:c2,fontWeight:900,fontSize:15}}>{schoolInfo.nom||"École"}</div>
          <div style={{color:"rgba(255,255,255,0.6)",fontSize:11}}>Espace Parent · {annee}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{utilisateur.nom}</div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
            <Badge color="teal">Parent</Badge>
            <button onClick={deconnecter} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",padding:"3px 10px",borderRadius:6,fontSize:11,cursor:"pointer",fontWeight:700}}>Déconnexion</button>
          </div>
        </div>
      </div>

      {/* Fiche élève */}
      <div style={{background:"#fff",borderBottom:"1px solid #f1f5f9",padding:"14px 24px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${c1},${c2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:900,flexShrink:0}}>
          {(eleveNom||"E")[0]}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:15,color:"#0A1628"}}>{eleveNom||"—"}</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>
            {eleve.classe&&<span style={{background:"#e0ebf8",color:c1,fontWeight:700,padding:"2px 8px",borderRadius:6,marginRight:8}}>{eleve.classe}</span>}
            {eleve.matricule&&<span style={{fontFamily:"monospace",fontSize:11,color:"#64748b"}}>#{eleve.matricule}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <div style={{textAlign:"center",padding:"8px 16px",background:"#f0fdf4",borderRadius:10}}>
            <div style={{fontWeight:900,fontSize:18,color:C.greenDk}}>{mesNotes.length}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>Notes</div>
          </div>
          <div style={{textAlign:"center",padding:"8px 16px",background:"#fff1f2",borderRadius:10}}>
            <div style={{fontWeight:900,fontSize:18,color:"#b91c1c"}}>{mesAbs.filter(a=>a.statut==="Absent").length}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>Absences</div>
          </div>
          {nonLus>0&&<div style={{textAlign:"center",padding:"8px 16px",background:"#fef3c7",borderRadius:10}}>
            <div style={{fontWeight:900,fontSize:18,color:"#d97706"}}>{nonLus}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>Non lus</div>
          </div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:"2px solid #e2e8f0",padding:"0 24px",display:"flex",gap:0,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"13px 16px",border:"none",background:"none",cursor:"pointer",
            fontSize:13,fontWeight:700,whiteSpace:"nowrap",
            color:tab===t.id?c1:t.bloque?"#ef4444":"#64748b",
            borderBottom:tab===t.id?`3px solid ${c1}`:"3px solid transparent",
            transition:"all .15s",
            opacity:t.bloque&&tab!==t.id?0.75:1,
          }}>
            {t.bloque?"🔒 ":""}{t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:"24px",maxWidth:1000,margin:"0 auto"}}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard"&&<>
          {/* Annonces */}
          {annonces.length>0&&<div style={{marginBottom:20}}>
            {annonces.sort((a,b)=>b.date-a.date).slice(0,3).map((an,i)=>(
              <div key={i} style={{
                background:an.important?"linear-gradient(135deg,#fef3c7,#fffbeb)":"#f8fafc",
                border:`1px solid ${an.important?"#fcd34d":"#e2e8f0"}`,
                borderLeft:`4px solid ${an.important?"#f59e0b":c1}`,
                borderRadius:"0 12px 12px 0",padding:"12px 18px",marginBottom:8,
              }}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  {an.important&&<span style={{fontSize:12}}>📌</span>}
                  <strong style={{fontSize:13,color:"#0A1628"}}>{an.titre}</strong>
                  <span style={{marginLeft:"auto",fontSize:10,color:"#94a3b8"}}>{an.auteur} · {new Date(an.date).toLocaleDateString("fr-FR")}</span>
                </div>
                <p style={{margin:0,fontSize:12,color:"#475569",lineHeight:1.6}}>{an.corps}</p>
              </div>
            ))}
          </div>}

          {/* Dernières notes */}
          {mesNotes.length>0&&<Card style={{marginBottom:16}}>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <strong style={{fontSize:13,color:c1}}>📝 Dernières notes</strong>
              <button onClick={()=>setTab("notes")} style={{fontSize:12,color:c1,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>Voir tout →</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <THead cols={["Matière","Type","Période","Note"]}/>
                <tbody>{mesNotes.slice(-6).reverse().map((n,i)=>(
                  <TR key={i}>
                    <TD bold>{n.matiere}</TD>
                    <TD><Badge color="blue">{n.type}</Badge></TD>
                    <TD>{n.periode}</TD>
                    <TD center><strong style={{color:Number(n.note)>=10?C.greenDk:"#b91c1c",fontSize:14}}>{n.note}/20</strong></TD>
                  </TR>
                ))}</tbody>
              </table>
            </div>
          </Card>}

          {/* Dernières absences */}
          {mesAbs.filter(a=>a.statut==="Absent").length>0&&<Card>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9"}}>
              <strong style={{fontSize:13,color:"#b91c1c"}}>⚠️ Absences récentes</strong>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <THead cols={["Date","Matière","Statut","Motif"]}/>
                <tbody>{mesAbs.filter(a=>a.statut==="Absent").slice(-5).map((a,i)=>(
                  <TR key={i}>
                    <TD>{a.date||"—"}</TD>
                    <TD>{a.matiere||"—"}</TD>
                    <TD><Badge color="red">Absent</Badge></TD>
                    <TD>{a.motif||"—"}</TD>
                  </TR>
                ))}</tbody>
              </table>
            </div>
          </Card>}

          {/* Graphique radar notes par matière */}
          {mesNotes.length>0&&(()=>{
            const radarData = matieres.map(mat=>{
              const ns = mesNotes.filter(n=>n.matiere===mat);
              const moy = ns.length ? ns.reduce((s,n)=>s+Number(n.note||0),0)/ns.length : 0;
              return { matiere:mat.length>10?mat.slice(0,10)+"…":mat, valeur:Math.round(moy*10)/10, plein:20 };
            });
            return radarData.length>=3?(
              <Card style={{marginBottom:16}}><div style={{padding:"14px 18px"}}>
                <p style={{margin:"0 0 8px",fontWeight:800,fontSize:13,color:c1}}>📊 Profil par matière</p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0"/>
                    <PolarAngleAxis dataKey="matiere" tick={{fontSize:10}}/>
                    <Radar name="Note" dataKey="valeur" stroke={c1} fill={c1} fillOpacity={0.25}/>
                    <Radar name="Max" dataKey="plein" stroke="transparent" fill="transparent"/>
                    <Tooltip formatter={v=>`${v}/20`}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div></Card>
            ):null;
          })()}

          {mesNotes.length===0&&mesAbs.length===0&&<Vide icone="🎓" msg="Aucune donnée disponible pour le moment"/>}
        </>}

        {/* ── NOTES ── */}
        {tab==="notes"&&<>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:900,color:c1}}>Notes de {eleveNom}</h2>
          {accesBloqueParPaiement ? <BlocagePaiement moisImpayes={moisImpayes} schoolInfo={schoolInfo} onPaiements={()=>setTab("paiements")}/>
          : mesNotes.length===0?<Vide icone="📝" msg="Aucune note disponible"/>
            :<>
              {matieres.map(mat=>{
                const notesM = mesNotes.filter(n=>n.matiere===mat);
                const moy = (notesM.reduce((s,n)=>s+Number(n.note||0),0)/notesM.length).toFixed(1);
                return (
                  <Card key={mat} style={{marginBottom:12}}>
                    <div style={{padding:"12px 18px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
                      <strong style={{fontSize:13,color:c1,flex:1}}>{mat}</strong>
                      <span style={{
                        background:Number(moy)>=10?"#dcfce7":"#fee2e2",
                        color:Number(moy)>=10?"#166534":"#b91c1c",
                        fontWeight:900,fontSize:13,padding:"4px 12px",borderRadius:20,
                      }}>Moy. {moy}/20</span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <THead cols={["Type","Période","Note /20"]}/>
                        <tbody>{notesM.map((n,i)=>(
                          <TR key={i}>
                            <TD><Badge color="blue">{n.type}</Badge></TD>
                            <TD>{n.periode}</TD>
                            <TD center><strong style={{color:Number(n.note)>=10?C.greenDk:"#b91c1c"}}>{n.note}/20</strong></TD>
                          </TR>
                        ))}</tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}
            </>}
        </>}

        {/* ── ABSENCES ── */}
        {tab==="absences"&&<>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:900,color:c1}}>Absences & présences</h2>
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <div style={{padding:"12px 20px",background:"#fee2e2",borderRadius:10,textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:22,color:"#b91c1c"}}>{mesAbs.filter(a=>a.statut==="Absent").length}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Absences</div>
            </div>
            <div style={{padding:"12px 20px",background:"#fef3c7",borderRadius:10,textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:22,color:"#d97706"}}>{mesAbs.filter(a=>a.statut==="Retard").length}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Retards</div>
            </div>
            <div style={{padding:"12px 20px",background:"#dcfce7",borderRadius:10,textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:22,color:"#166534"}}>{mesAbs.filter(a=>a.statut==="Présent").length}</div>
              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Présences</div>
            </div>
          </div>
          {mesAbs.length===0?<Vide icone="📋" msg="Aucune absence enregistrée"/>
            :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Date","Matière","Statut","Motif"]}/>
              <tbody>{mesAbs.map((a,i)=>(
                <TR key={i}>
                  <TD>{a.date||"—"}</TD>
                  <TD>{a.matiere||"—"}</TD>
                  <TD><Badge color={a.statut==="Absent"?"red":a.statut==="Retard"?"amber":"vert"}>{a.statut||"—"}</Badge></TD>
                  <TD>{a.motif||"—"}</TD>
                </TR>
              ))}</tbody>
            </table></Card>}
        </>}

        {/* ── BULLETINS ── */}
        {tab==="bulletins"&&<>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:900,color:c1}}>Bulletins scolaires</h2>
          {accesBloqueParPaiement && <BlocagePaiement moisImpayes={moisImpayes} schoolInfo={schoolInfo} onPaiements={()=>setTab("paiements")}/>}
          {!accesBloqueParPaiement && <LectureSeule/>}
          {!accesBloqueParPaiement && <>
          {["T1","T2","T3"].map(periode=>{
            const notesP = mesNotes.filter(n=>n.periode===periode);
            if(notesP.length===0) return null;
            const moy = (notesP.reduce((s,n)=>s+Number(n.note||0),0)/notesP.length).toFixed(1);
            return (
              <Card key={periode} style={{marginBottom:12}}>
                <div style={{padding:"12px 18px",background:`linear-gradient(135deg,${c1},${c1}cc)`,borderRadius:"14px 14px 0 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <strong style={{color:"#fff",fontSize:14}}>Bulletin — {periode}</strong>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{background:c2,color:"#fff",fontWeight:900,fontSize:13,padding:"4px 14px",borderRadius:20}}>Moy. {moy}/20</span>
                    <button onClick={()=>imprimerBulletin(
                      {...eleve,nom:eleveNom.split(" ").slice(-1)[0]||eleveNom,prenom:eleveNom.split(" ").slice(0,-1).join(" ")},
                      notesP, [...new Set(notesP.map(n=>n.matiere))].map(n=>({nom:n})),
                      periode, sec==="primaire"?"Primaire":"Secondaire", sec==="primaire"?10:20, schoolInfo
                    )} style={{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",color:"#fff",padding:"4px 10px",borderRadius:8,fontSize:11,cursor:"pointer",fontWeight:700}}>
                      🖨️ Imprimer
                    </button>
                  </div>
                </div>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <THead cols={["Matière","Type","Note /20"]}/>
                  <tbody>{notesP.map((n,i)=>(
                    <TR key={i}>
                      <TD bold>{n.matiere}</TD>
                      <TD><Badge color="blue">{n.type}</Badge></TD>
                      <TD center><strong style={{color:Number(n.note)>=10?C.greenDk:"#b91c1c"}}>{n.note}/20</strong></TD>
                    </TR>
                  ))}</tbody>
                </table>
              </Card>
            );
          })}
          {mesNotes.length===0&&<Vide icone="📄" msg="Aucun bulletin disponible pour le moment"/>}
          </>}
        </>}

        {/* ── PAIEMENTS ── */}
        {tab==="paiements"&&<>
          <h2 style={{margin:"0 0 16px",fontSize:16,fontWeight:900,color:c1}}>Suivi des paiements</h2>
          {(()=>{
            const mens = eleveCourant.mens||{};
            const mensDates = eleveCourant.mensDates||{};
            const moisList = moisAnneeCtx.length ? moisAnneeCtx : Object.keys(mens);
            const nbPayes = moisList.filter(m=>mens[m]==="Payé").length;
            const nbImp   = moisList.filter(m=>mens[m]!=="Payé").length;
            const fraisAnnexes = [
              {
                id:"inscription",
                label:eleveCourant.typeInscription==="Réinscription"?"Réinscription":"Inscription",
                montant:montantInscription,
                paye:!!eleveCourant.inscriptionPayee,
                date:eleveCourant.inscriptionDate||"",
                couleur:eleveCourant.inscriptionPayee?"#dbeafe":"#fee2e2",
                bordure:eleveCourant.inscriptionPayee?"#93c5fd":"#fca5a5",
                texte:eleveCourant.inscriptionPayee?"#1d4ed8":"#b91c1c",
              },
              {
                id:"autre",
                label:"Autre frais",
                montant:montantAutre,
                paye:!!eleveCourant.autrePayee,
                date:eleveCourant.autreDate||"",
                couleur:eleveCourant.autrePayee?"#e2e8f0":"#fee2e2",
                bordure:eleveCourant.autrePayee?"#94a3b8":"#fca5a5",
                texte:eleveCourant.autrePayee?"#334155":"#b91c1c",
              },
            ].filter((frais)=>frais.montant>0);
            return (
              <>
                <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                  <div style={{padding:"14px 20px",background:"#dcfce7",borderRadius:12,textAlign:"center",minWidth:120}}>
                    <div style={{fontWeight:900,fontSize:24,color:"#166534"}}>{nbPayes}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Mois payés</div>
                  </div>
                  <div style={{padding:"14px 20px",background:"#fee2e2",borderRadius:12,textAlign:"center",minWidth:120}}>
                    <div style={{fontWeight:900,fontSize:24,color:"#b91c1c"}}>{nbImp}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Mois impayés</div>
                  </div>
                  <div style={{padding:"14px 20px",background:"#f0fdf4",borderRadius:12,textAlign:"center",minWidth:120}}>
                    <div style={{fontWeight:900,fontSize:24,color:c2}}>{moisList.length?Math.round(nbPayes/moisList.length*100):0}%</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Taux</div>
                  </div>
                  <div style={{padding:"14px 20px",background:"#eff6ff",borderRadius:12,textAlign:"center",minWidth:150}}>
                    <div style={{fontWeight:900,fontSize:20,color:"#1d4ed8"}}>{fmt(montantMensuel)}</div>
                    <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Mensualité</div>
                  </div>
                </div>
                {fraisAnnexes.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10,marginBottom:18}}>
                  {fraisAnnexes.map((frais)=>(
                    <div key={frais.id} style={{padding:"14px 16px",borderRadius:14,background:frais.couleur,border:`1px solid ${frais.bordure}`}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                        <strong style={{fontSize:13,color:frais.texte}}>{frais.label}</strong>
                        <Badge color={frais.paye?"green":"red"}>{frais.paye?"Payé":"Impayé"}</Badge>
                      </div>
                      <div style={{fontSize:20,fontWeight:900,color:frais.texte,marginTop:10}}>{fmt(frais.montant)}</div>
                      <div style={{fontSize:11,color:"#64748b",marginTop:4}}>
                        {frais.paye&&frais.date?`Réglé le ${frais.date}`:"En attente de règlement"}
                      </div>
                    </div>
                  ))}
                </div>}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}}>
                  {moisList.map(m=>{
                    const paye = mens[m]==="Payé";
                    return (
                      <div key={m} style={{
                        padding:"12px 16px",borderRadius:12,
                        background:paye?"#dcfce7":"#fee2e2",
                        border:`2px solid ${paye?"#86efac":"#fca5a5"}`,
                      }}>
                        <div style={{fontWeight:800,fontSize:13,color:paye?"#166534":"#b91c1c"}}>{m}</div>
                        <div style={{fontSize:11,marginTop:4,color:paye?"#15803d":"#dc2626",fontWeight:700}}>
                          {paye?"✅ Payé":"❌ Impayé"}
                        </div>
                        {paye&&mensDates[m]&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{mensDates[m]}</div>}
                      </div>
                    );
                  })}
                </div>
                {moisList.length===0&&fraisAnnexes.length===0&&<Vide icone="💳" msg="Aucune information de paiement"/>}
              </>
            );
          })()}
        </>}

        {/* ── MESSAGES ── */}
        {tab==="messages"&&<>
          <h2 style={{margin:"0 0 20px",fontSize:16,fontWeight:900,color:c1}}>Messages avec l'école</h2>

          {/* Fil de messages */}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
            {mesMessages.length===0&&<Vide icone="💬" msg="Aucun message pour le moment"/>}
            {mesMessages.map((m,i)=>{
              const estParent = m.expediteur==="parent";
              return (
                <div key={i} style={{
                  display:"flex",flexDirection:"column",
                  alignItems:estParent?"flex-end":"flex-start",
                }}>
                  <div style={{
                    maxWidth:"75%",background:estParent?`${c1}15`:"#fff",
                    border:`1px solid ${estParent?c1+"33":"#e2e8f0"}`,
                    borderRadius:estParent?"16px 16px 4px 16px":"16px 16px 16px 4px",
                    padding:"12px 16px",
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:estParent?c1:"#64748b"}}>{estParent?"Vous":m.expediteurNom||"École"}</span>
                      <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0A1628",marginBottom:4}}>{m.sujet}</div>
                    <div style={{fontSize:13,color:"#475569",lineHeight:1.6}}>{m.corps}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Formulaire d'envoi */}
          <Card>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9"}}>
              <strong style={{fontSize:13,color:c1}}>✉️ Envoyer un message à l'école</strong>
            </div>
            <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
              <Input label="Sujet" value={sujet} onChange={e=>setSujet(e.target.value)} placeholder="Ex : Justification d'absence du 12/04"/>
              <Champ label="Message">
                <textarea value={corps} onChange={e=>setCorps(e.target.value)}
                  rows={4} placeholder="Écrivez votre message ici..."
                  style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,resize:"vertical",outline:"none",fontFamily:"inherit"}}/>
              </Champ>
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <Btn onClick={envoyer} disabled={envoi}>{envoi?"Envoi...":"📨 Envoyer"}</Btn>
              </div>
            </div>
          </Card>
        </>}

      </div>
    </div>
  );
}



export { PortailParent };
