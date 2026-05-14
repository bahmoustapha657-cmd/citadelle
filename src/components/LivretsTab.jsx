import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, getAnnee, today } from "../constants";
import { getSubjectAverage } from "../note-utils";
import { imprimerLivret } from "../reports";
import { Badge, Btn, Card, Input, Modale, Selec, Stat, TD, THead, TR, Vide } from "./ui";

// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  COMPOSANT LIVRETS SCOLAIRES
// ══════════════════════════════════════════════════════════════
function LivretsTab({cleEleves, cleNotes, matieres, maxNote, userRole, annee}) {
  const { t } = useTranslation();
  const {schoolInfo, toast} = useContext(SchoolContext);
  const {items:livrets, ajouter:ajLivret, modifier:modLivret} = useFirestore("livrets");
  const {items:eleves} = useFirestore(cleEleves);
  const {items:notes}  = useFirestore(cleNotes);
  const section = cleEleves.includes("Primaire")?"primaire":cleEleves.includes("Lycee")?"lycee":"college";
  const canEdit = ["direction","admin","comptable"].includes(userRole);

  const [livretSelId, setLivretSelId] = useState(null);
  const [filtreClasse, setFiltreClasse] = useState("all");
  const [modal, setModal] = useState(null); // "annee"
  const [formAnnee, setFormAnnee] = useState({});
  const [savingL, setSavingL] = useState(false);

  const classesUniq = [...new Set(eleves.map(e=>e.classe))].filter(Boolean).sort();
  const elevesFiltr = filtreClasse==="all" ? eleves : eleves.filter(e=>e.classe===filtreClasse);
  const livretSel = livrets.find(l=>l._id===livretSelId);

  // Génère un numéro de livret
  const genNumeroLivret = () => {
    const an = getAnnee().split("-")[0].slice(-2);
    const nums = livrets.map(l=>parseInt((l.numeroLivret||"").replace(/[^0-9]/g,""))||0);
    const n = nums.length>0 ? Math.max(...nums)+1 : 1;
    return `LIV-${an}-${String(n).padStart(4,"0")}`;
  };

  // Crée ou ouvre le livret d'un élève
  const ouvrirLivret = async (eleve) => {
    const existing = livrets.find(l=>l.eleveId===eleve._id);
    if(existing){ setLivretSelId(existing._id); return; }
    if(!canEdit){toast("Création réservée à la direction/admin.","warning");return;}
    setSavingL(true);
    try {
      const id = await ajLivret({
        eleveId: eleve._id,
        eleveNom: `${eleve.nom} ${eleve.prenom}`,
        matricule: eleve.matricule||"",
        ien: eleve.ien||"",
        dateNaissance: eleve.dateNaissance||"",
        lieuNaissance: eleve.lieuNaissance||"",
        photo: eleve.photo||"",
        section,
        numeroLivret: genNumeroLivret(),
        dateCreation: new Date().toISOString().slice(0,10),
        annees: [],
        annee: annee||getAnnee(),
      });
      setLivretSelId(id);
      toast("Livret créé","success");
    } finally { setSavingL(false); }
  };

  // Pré-remplit une nouvelle entrée annuelle depuis les notes actuelles
  const preRemplirAnnee = (eleve) => {
    const notesEleve = notes.filter(n=>n.eleveId===eleve._id);
    const matieresList = matieres.map(mat=>{
      const notesParPeriode = ["T1","T2","T3"].reduce((acc,p)=>{
        const ns = notesEleve.filter(n=>n.matiere===mat.nom&&n.periode===p);
        acc[p] = getSubjectAverage(ns, eleve.classe, section);
        return acc;
      },{});
      const avec = Object.values(notesParPeriode).filter(v=>v!==null);
      const ann = avec.length ? avec.reduce((s,v)=>s+v,0)/avec.length : null;
      return {matiere:mat.nom, coef:mat.coefficient||1, maxNote,
        T1:notesParPeriode.T1, T2:notesParPeriode.T2, T3:notesParPeriode.T3,
        annuelle:ann};
    });
    return {
      anneeScolaire: annee||getAnnee(),
      classe: eleve.classe||"",
      enseignantPrincipal: "",
      notes: matieresList,
      absences: {justifiees:0, nonJustifiees:0},
      rang: "", effectifClasse: eleves.filter(e=>e.classe===eleve.classe).length,
      appreciation: "", decision: "Admis",
      signe: false, dateSigne: null,
    };
  };

  const sauvegarderAnnee = async () => {
    if(!livretSel) return;
    setSavingL(true);
    try {
      const annees = [...(livretSel.annees||[])];
      if(formAnnee._idx!=null) annees[formAnnee._idx] = {...formAnnee, _idx:undefined};
      else annees.push({...formAnnee});
      await modLivret(livretSel._id,{annees});
      setModal(null);
      toast("Année enregistrée","success");
    } finally { setSavingL(false); }
  };

  const signerAnnee = async (livretId, idx) => {
    const lv = livrets.find(l=>l._id===livretId);
    if(!lv) return;
    const annees = [...lv.annees];
    annees[idx] = {...annees[idx], signe:true, dateSigne:today()};
    await modLivret(livretId,{annees});
    toast("Année signée et verrouillée","success");
  };

  const chgAnnee = k => e => setFormAnnee(p=>({...p,[k]:e.target.value}));
  const chgAbs  = k => e => setFormAnnee(p=>({...p,absences:{...(p.absences||{}), [k]:Number(e.target.value)}}));

  // ── Vue détail d'un livret ─────────────────────────────────
  if(livretSel) {
    const eleve = eleves.find(e=>e._id===livretSel.eleveId)||{};
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <Btn sm v="ghost" onClick={()=>setLivretSelId(null)}>← {t("common.back")}</Btn>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>
            📋 Livret — {livretSel.eleveNom} · <span style={{fontFamily:"monospace",color:C.blue}}>{livretSel.numeroLivret}</span>
          </strong>
          <Btn sm v="vert" onClick={()=>imprimerLivret({...livretSel,photo:eleve.photo||livretSel.photo},schoolInfo)}>🖨️ Imprimer le livret</Btn>
          {canEdit&&<Btn sm v="blue" onClick={()=>{setFormAnnee({...preRemplirAnnee(eleve)});setModal("annee");}}>+ Nouvelle année</Btn>}
        </div>

        {(livretSel.annees||[]).length===0
          ? <Vide icone="📅" msg="Aucune année saisie — cliquez sur '+ Nouvelle année'"/>
          : (livretSel.annees||[]).map((an,idx)=>(
            <Card key={idx} style={{marginBottom:14,border:`2px solid ${an.signe?"#86efac":"#e5e7eb"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:an.signe?"#f0fdf4":"#f8fafc",borderRadius:"14px 14px 0 0"}}>
                <strong style={{flex:1,fontSize:13,color:C.blueDark}}>Année {an.anneeScolaire} — {an.classe}</strong>
                <Badge color={an.decision==="Admis avec félicitations"||an.decision==="Admis"?"vert":an.decision==="Redoublant"?"amber":"red"}>{an.decision||"—"}</Badge>
                {an.signe
                  ? <span style={{fontSize:11,color:"#15803d",fontWeight:700}}>✅ Signé le {an.dateSigne}</span>
                  : canEdit&&<>
                      <Btn sm v="ghost" onClick={()=>{setFormAnnee({...an,_idx:idx});setModal("annee");}}>✏️ Modifier</Btn>
                      <Btn sm v="vert" onClick={()=>signerAnnee(livretSel._id,idx)}>✍️ Signer</Btn>
                    </>
                }
              </div>
              <div style={{padding:"12px 16px",fontSize:12}}>
                <div style={{display:"flex",gap:20,marginBottom:8,flexWrap:"wrap",color:"#374151"}}>
                  <span>Enseignant : <strong>{an.enseignantPrincipal||"—"}</strong></span>
                  <span>Rang : <strong>{an.rang||"—"}/{an.effectifClasse||"—"}</strong></span>
                  <span>Abs. justifiées : <strong>{an.absences?.justifiees||0}</strong></span>
                  <span>Abs. non just. : <strong>{an.absences?.nonJustifiees||0}</strong></span>
                </div>
                {an.appreciation&&<div style={{fontStyle:"italic",color:"#6b7280",marginBottom:6}}>"{an.appreciation}"</div>}
                <details><summary style={{cursor:"pointer",color:C.blue,fontSize:12,fontWeight:700}}>Voir les notes ({(an.notes||[]).length} matières)</summary>
                  <table style={{width:"100%",borderCollapse:"collapse",marginTop:8,fontSize:11}}>
                    <THead cols={["Matière","Coef","T1","T2","T3","Annuelle"]}/>
                    <tbody>{(an.notes||[]).map((n,i)=><TR key={i}>
                      <TD bold>{n.matiere}</TD><TD center>{n.coef}</TD>
                      <TD center>{n.T1!=null?Number(n.T1).toFixed(1):"—"}</TD>
                      <TD center>{n.T2!=null?Number(n.T2).toFixed(1):"—"}</TD>
                      <TD center>{n.T3!=null?Number(n.T3).toFixed(1):"—"}</TD>
                      <TD center><strong style={{color:n.annuelle>=maxNote/2?"#15803d":"#b91c1c"}}>{n.annuelle!=null?Number(n.annuelle).toFixed(2):"—"}</strong></TD>
                    </TR>)}</tbody>
                  </table>
                </details>
              </div>
            </Card>
          ))
        }

        {/* Modal saisie année */}
        {modal==="annee"&&<Modale large titre={formAnnee._idx!=null?"Modifier l'année":"Nouvelle année scolaire"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
            <Input label="Année scolaire" value={formAnnee.anneeScolaire||""} onChange={chgAnnee("anneeScolaire")} placeholder="2024-2025"/>
            <Input label="Classe" value={formAnnee.classe||""} onChange={chgAnnee("classe")}/>
            <Input label="Enseignant(e) principal(e)" value={formAnnee.enseignantPrincipal||""} onChange={chgAnnee("enseignantPrincipal")}/>
            <Input label="Rang" type="number" value={formAnnee.rang||""} onChange={chgAnnee("rang")}/>
            <Input label="Effectif classe" type="number" value={formAnnee.effectifClasse||""} onChange={chgAnnee("effectifClasse")}/>
            <Selec label="Décision du conseil" value={formAnnee.decision||"Admis"} onChange={chgAnnee("decision")}>
              <option>Admis</option>
              <option>Admis avec félicitations</option>
              <option>Redoublant</option>
              <option>Exclu</option>
            </Selec>
            <div style={{gridColumn:"1/3"}}>
              <Input label="Absences justifiées" type="number" value={formAnnee.absences?.justifiees||0} onChange={chgAbs("justifiees")}/>
            </div>
            <Input label="Absences non justifiées" type="number" value={formAnnee.absences?.nonJustifiees||0} onChange={chgAbs("nonJustifiees")}/>
            <div style={{gridColumn:"1/-1"}}>
              <label style={{fontSize:12,fontWeight:700,color:C.blueDark,display:"block",marginBottom:4}}>Appréciation générale</label>
              <textarea value={formAnnee.appreciation||""} onChange={chgAnnee("appreciation")} rows={3}
                style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:8,padding:"8px 12px",fontSize:12,resize:"vertical"}}/>
            </div>
          </div>
          {(formAnnee.notes||[]).length>0&&<>
            <p style={{fontWeight:700,fontSize:12,color:C.blueDark,margin:"0 0 8px"}}>Notes par matière (pré-remplies depuis les bulletins)</p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:14}}>
                <THead cols={["Matière","Coef","T1","T2","T3","Annuelle"]}/>
                <tbody>{(formAnnee.notes||[]).map((n,i)=>(
                  <TR key={i}>
                    <TD bold>{n.matiere}</TD>
                    <TD center><input type="number" value={n.coef||1}
                      onChange={e=>{const ns=[...formAnnee.notes];ns[i]={...ns[i],coef:Number(e.target.value)};setFormAnnee(p=>({...p,notes:ns}));}}
                      style={{width:40,textAlign:"center",border:"1px solid #b0c4d8",borderRadius:4,padding:"2px 4px"}}/></TD>
                    {["T1","T2","T3"].map(p=>(
                      <td key={p} style={{padding:"2px 6px",textAlign:"center"}}>
                        <input type="number" value={n[p]!=null?n[p]:""}
                          onChange={e=>{const ns=[...formAnnee.notes];ns[i]={...ns[i],[p]:e.target.value===""?null:Number(e.target.value)};setFormAnnee(p=>({...p,notes:ns}));}}
                          style={{width:50,textAlign:"center",border:"1px solid #b0c4d8",borderRadius:4,padding:"2px 4px"}}/>
                      </td>
                    ))}
                    <td style={{padding:"2px 8px",textAlign:"center",fontWeight:700,color:n.annuelle>=maxNote/2?"#15803d":"#b91c1c"}}>
                      {n.annuelle!=null?Number(n.annuelle).toFixed(2):"—"}
                    </td>
                  </TR>
                ))}</tbody>
              </table>
            </div>
          </>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn v="success" onClick={sauvegarderAnnee} disabled={savingL}>{savingL?"Enregistrement…":"💾 Enregistrer"}</Btn>
          </div>
        </Modale>}
      </div>
    );
  }

  // ── Vue liste des livrets ──────────────────────────────────
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,flex:1,color:C.blueDark}}>📋 Livrets scolaires ({livrets.length})</strong>
        <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          <option value="all">Toutes les classes</option>
          {classesUniq.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      {elevesFiltr.length===0
        ? <Vide icone="📋" msg="Aucun élève dans cette sélection"/>
        : <Card>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <THead cols={["Matricule","Nom & Prénom","Classe","Livret","Années saisies","Action"]}/>
              <tbody>{elevesFiltr.map(e=>{
                const lv = livrets.find(l=>l.eleveId===e._id);
                return <TR key={e._id}>
                  <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
                  <TD bold>{e.nom} {e.prenom}</TD>
                  <TD><Badge color="blue">{e.classe}</Badge></TD>
                  <TD>{lv
                    ? <span style={{fontFamily:"monospace",fontSize:11,color:C.blue}}>{lv.numeroLivret}</span>
                    : <span style={{fontSize:11,color:"#9ca3af"}}>Non créé</span>}
                  </TD>
                  <TD center>{lv ? <Badge color={(lv.annees||[]).length>0?"vert":"gray"}>{(lv.annees||[]).length} an(s)</Badge> : "—"}</TD>
                  <TD>
                    <Btn sm v={lv?"ghost":"blue"} onClick={()=>ouvrirLivret(e)} disabled={savingL}>
                      {lv?"📂 Ouvrir":"📋 Créer"}
                    </Btn>
                    {lv&&<Btn sm v="amber" style={{marginLeft:4}} onClick={()=>imprimerLivret({...lv,photo:e.photo||lv.photo},schoolInfo)}>🖨️</Btn>}
                  </TD>
                </TR>;
              })}</tbody>
            </table>
          </Card>
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════════

export { LivretsTab };
