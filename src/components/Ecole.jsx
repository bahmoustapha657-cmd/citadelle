import React, { useContext, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C, today, genererMdp, peutModifier } from "../constants";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { getGeneralAverage } from "../note-utils";
import { findStaffDuplicate, getStaffDuplicateMessage } from "../staff-utils";
import { getEligibleTeachersForTimetable, getTeacherMonthlyForfait } from "../teacher-utils";
import { Badge, Card, Modale, Champ, Input, Selec, Textarea, Btn, THead, TR, TD, Stat, Tabs, Vide, Chargement, LectureSeule, UploadFichiers } from "./ui";
import { enteteDoc, imprimerCartesEleves, imprimerListeClasse, imprimerAttestation, imprimerBulletin, imprimerBulletinsGroupes, imprimerFicheCompositions, exportExcel } from "../reports";
import { LivretsTab } from "./LivretsTab";

const loadXLSX = () => import("xlsx");

function Ecole({titre, couleur, cleClasses, cleEns, cleNotes, cleEleves, avecEns, userRole, annee, classesPredefinies, maxNote=20, matieresPredefinies=[], readOnly=false, verrouOuvert=false}) {
  const isPrimarySection = cleEns === "ensPrimaire";
  const {items:classes,chargement:cC,ajouter:ajC,modifier:modC,supprimer:supC}=useFirestore(cleClasses);
  const {items:ens,chargement:cEns,ajouter:ajEns,modifier:modEns,supprimer:supEns}=useFirestore(cleEns);
  const {items:notes,chargement:cN,ajouter:ajN,supprimer:supN}=useFirestore(cleNotes);
  const {items:eleves,chargement:cE,modifier:modE}=useFirestore(cleEleves);
  const {items:absences,chargement:cAbs,ajouter:ajAbs,supprimer:supAbs}=useFirestore(cleEleves+"_absences");
  const {items:enseignements,chargement:cEng,ajouter:ajEng,modifier:modEng,supprimer:supEng}=useFirestore(cleEns+"_enseignements");
  const {items:matieres,chargement:cMat,ajouter:ajMat,modifier:modMat,supprimer:supMat}=useFirestore(cleClasses+"_matieres");
  const {items:emplois,chargement:cEmp,ajouter:ajEmp,modifier:modEmp,supprimer:supEmp}=useFirestore(cleClasses+"_emplois");
  const cleAppreciations=cleNotes.replace("notes","appreciations");
  const {items:appreciations,ajouter:ajApp,modifier:modApp}=useFirestore(cleAppreciations);
  const getAppreciation=(eleveId,periode)=>appreciations.find(a=>a.eleveId===eleveId&&a.periode===periode);
  const saveAppreciation=async(eleveId,periode,texte)=>{
    const existant=getAppreciation(eleveId,periode);
    const data={eleveId,periode,texte:String(texte||"").trim(),updatedAt:Date.now()};
    if(existant)await modApp({...existant,...data});
    else await ajApp(data);
  };
  const appreciationsParEleveB=(periode)=>Object.fromEntries(
    appreciations.filter(a=>a.periode===periode&&a.texte).map(a=>[a.eleveId,a.texte])
  );

  const [tab,setTab]=useState("apercu");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const [filtreClasse,setFiltreClasse]=useState("all");
  const [edtVueGrille,setEdtVueGrille]=useState(true);
  const [edtCellule,setEdtCellule]=useState(null); // {jour,heureDebut,heureFin,existing?}
  const [edtDuree,setEdtDuree]=useState(maxNote===10?60:120); // primaire: 30/45/60min, secondaire: 120min fixe
  // Matières filtrées par classe : si la matière a des classes assignées, on filtre ; sinon elle s'applique à tout
  const matieresForClasse = (classe) => {
    if(!classe||classe==="all") return matieres;
    return matieres.filter(m=>!m.classes||!m.classes.length||m.classes.includes(classe));
  };
  const [edtGeneralOuvert,setEdtGeneralOuvert]=useState(false);
  const [edtHeureDebut,setEdtHeureDebut]=useState("08:00");
  const [edtHeureFin,setEdtHeureFin]=useState("14:00");
  const [periodeB,setPeriodeB]=useState("T1");
  const [rechercheMatricule,setRechercheMatricule]=useState("");
  const [ensCompte,setEnsCompte]=useState(null);
  const [formC,setFormC]=useState({});
  const [parentEleve,setParentEleve]=useState(null);
  const [formP,setFormP]=useState({});
  const [importPreview,setImportPreview]=useState(null);
  const [importEnCours,setImportEnCours]=useState(false);
  const [notesVue,setNotesVue]=useState("liste"); // "liste" | "grille"
  const [grilleClasse,setGrilleClasse]=useState("all");
  const [grillePeriode,setGrillePeriode]=useState("T1");
  const [grilleType,setGrilleType]=useState("Devoir");
  const [grilleChanges,setGrilleChanges]=useState({}); // {"eleveId|matiere": note}
  const [grilleSaving,setGrilleSaving]=useState(false);
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const chgC=k=>e=>setFormC(p=>({...p,[k]:e.target.value}));
  const chgP=k=>e=>setFormP(p=>({...p,[k]:e.target.value}));
  const {schoolId, schoolInfo, moisAnnee, toast, logAction, envoyerPush} = useContext(SchoolContext);
  const canCreate = !readOnly;
  const canEdit = !readOnly && (peutModifier(userRole) || verrouOuvert);
  const moy=notes.length?(notes.reduce((s,n)=>s+Number(n.note),0)/notes.length).toFixed(1):"—";
  const classesUniq=[...new Set(eleves.map(e=>e.classe))].filter(Boolean);
  const sortAlphaEcole = arr => {
    const tri = schoolInfo.triEleves || "prenom_nom";
    return [...arr].sort((a,b)=>{
      const withClasse = tri==="classe_prenom"||tri==="classe_nom";
      const sa = withClasse
        ? (tri==="classe_nom" ? `${a.classe||""} ${a.nom} ${a.prenom}` : `${a.classe||""} ${a.prenom} ${a.nom}`)
        : (tri==="nom_prenom" ? `${a.nom} ${a.prenom}` : `${a.prenom} ${a.nom}`);
      const sb = withClasse
        ? (tri==="classe_nom" ? `${b.classe||""} ${b.nom} ${b.prenom}` : `${b.classe||""} ${b.prenom} ${b.nom}`)
        : (tri==="nom_prenom" ? `${b.nom} ${b.prenom}` : `${b.prenom} ${b.nom}`);
      return sa.localeCompare(sb,"fr",{sensitivity:"base"});
    });
  };
  const elevesFiltres=sortAlphaEcole(filtreClasse==="all"?eleves:eleves.filter(e=>e.classe===filtreClasse));
  // Effectif réel = nombre d'élèves dont le champ classe correspond
  const effectifReel = (nomClasse) => eleves.filter(e=>e.classe===nomClasse && e.statut!=="Départ").length;

  const tabItems=[
    {id:"apercu",label:"Aperçu"},
    {id:"classes",label:`Classes (${classes.length})`},
    {id:"eleves",label:`Élèves (${eleves.length})`},
    ...(avecEns?[{id:"ens",label:`Enseignants (${ens.length})`}]:[]),
    {id:"notes",label:`Notes (${notes.length})`},
    {id:"enseignements",label:"Enseignements"},
    {id:"discipline",label:"Discipline"},
    {id:"bulletins",label:"Bulletins"},
    {id:"livrets",label:"📋 Livrets"},
    {id:"matieres",label:"Matières"},
    ...(avecEns?[{id:"emploidutemps",label:"Emplois du temps"}]:[]),
    {id:"attestations",label:"Attestations de niveau"},
  ];

  const saveClasse=()=>{
    const row={...form,effectif:Number(form.effectif||0)};
    if(modal==="add_c"){ajC(row);}
    else {
      const ancienNom=classes.find(c=>c._id===form._id)?.nom;
      modC(row);
      if(ancienNom&&ancienNom!==form.nom)
        eleves.filter(e=>e.classe===ancienNom).forEach(e=>modE({...e,classe:form.nom}));
    }
    setModal(null);
  };

  const saveEnseignant = async () => {
    const row = { ...form };
    const doublon = findStaffDuplicate(row, ens, {
      excludeId: modal === "edit_ens" ? row._id : null,
    });
    if (doublon) {
      toast(getStaffDuplicateMessage(doublon, { label: "cet enseignant" }), "warning");
      return;
    }

    if (modal === "add_ens") {
      await ajEns(row);
    } else {
      await modEns(row);
    }

    if (row.classeTitle) {
      const nomEns = `${row.prenom || ""} ${row.nom || ""}`.trim();
      const existante = classes.find((c) => c.nom === row.classeTitle);
      if (!existante) {
        await ajC({ nom: row.classeTitle, effectif: 0, enseignant: nomEns });
      } else if (nomEns && existante.enseignant !== nomEns) {
        await modC({ ...existante, enseignant: nomEns });
      }
    }

    setModal(null);
  };

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>{titre}</h2>
          <p style={{margin:0,fontSize:12,color:couleur,fontWeight:700}}>Gestion des classes, élèves, notes et discipline</p>
        </div>
      </div>
      {readOnly&&<LectureSeule/>}
      <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#92400e",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>🔒</span>
        <span>L'enrôlement et la suppression des élèves se font uniquement dans le module <strong>Comptabilité → Élèves</strong>.</span>
      </div>
      <Tabs items={tabItems} actif={tab} onChange={setTab}/>

      {/* ── APERÇU ── */}
      {tab==="apercu"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
          <Stat label="Classes" value={classes.length}/>
          <Stat label="Élèves actifs" value={eleves.filter(e=>e.statut==="Actif").length} sub={`sur ${eleves.length}`}/>
          {avecEns&&<Stat label="Enseignants" value={ens.length}/>}
          <Stat label="Moy. Générale" value={`${moy}/${maxNote}`} bg="#eaf4e0"/>
          <Stat label="Absences" value={absences.length} bg="#fef3e0"/>
        </div>
        {(cC||cE)?<Chargement/>:classes.length===0&&eleves.length===0?<Vide icone={avecEns?"🏫":"🎒"} msg="Module vide"/>
          :<Card><div style={{padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <p style={{margin:0,fontWeight:800,fontSize:14,color:C.blueDark}}>Effectifs par classe</p>
              <div style={{display:"flex",gap:8}}>
                {classesUniq.map(cl=>(
                  <Btn sm key={cl} v="ghost" onClick={()=>imprimerListeClasse(cl,eleves,schoolInfo)}>🖨️ {cl}</Btn>
                ))}
              </div>
            </div>
            {classes.map(c=>(
              <div key={c._id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:C.blueDark,width:76}}>{c.nom}</span>
                <div style={{flex:1,background:"#e0ebf8",borderRadius:5,height:8}}>
                  <div style={{background:couleur,borderRadius:5,height:8,width:`${Math.min(effectifReel(c.nom)/50*100,100).toFixed(0)}%`}}/>
                </div>
                <span style={{fontSize:11,color:"#6b7280",width:26,textAlign:"right",fontWeight:600}}>{effectifReel(c.nom)}</span>
              </div>
            ))}
          </div></Card>}

          {/* ── GRAPHIQUE EFFECTIFS + MOYENNES ── */}
          {classes.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <Card><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Effectifs par classe</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classes.map(c=>({classe:c.nom,Effectif:effectifReel(c.nom)}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="classe" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip/>
                  <Bar dataKey="Effectif" fill={couleur} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div></Card>

            <Card><div style={{padding:"14px 16px"}}>
              <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Moyenne générale par classe</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={classes.map(c=>{
                  const elevesClasse=eleves.filter(e=>e.classe===c.nom);
                  if(!elevesClasse.length) return {classe:c.nom,Moyenne:0};
                  const moyClasse=elevesClasse.map(e=>{
                    const notesE=notes.filter(n=>n.eleveId===e._id);
                    return getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe);
                  }).filter(m=>m!==null);
                  const moy=moyClasse.length?(moyClasse.reduce((s,m)=>s+m,0)/moyClasse.length).toFixed(2):0;
                  return {classe:c.nom,Moyenne:Number(moy)};
                })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                  <XAxis dataKey="classe" tick={{fontSize:10}}/>
                  <YAxis domain={[0,maxNote]} tick={{fontSize:10}}/>
                  <Tooltip formatter={v=>`${v}/${maxNote}`}/>
                  <Bar dataKey="Moyenne" fill="#f59e0b" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div></Card>
          </div>}

          {/* ── TABLEAU D'HONNEUR ── */}
          {eleves.length>0&&(()=>{
            const classement=eleves.map(e=>{
              const notesPeriode=notes.filter(n=>n.eleveId===e._id);
              const moyenne = getGeneralAverage(notesPeriode, matieresForClasse(e.classe), e.classe);
              return {...e, moyGene:moyenne||0};
            }).filter(e=>e.moyGene>0).sort((a,b)=>b.moyGene-a.moyGene).slice(0,5);
            if(!classement.length) return null;
            return (
              <div style={{marginTop:16}}>
                <div style={{background:"linear-gradient(90deg,#d97706,#f59e0b)",color:"#fff",padding:"10px 16px",borderRadius:"10px 10px 0 0",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",gap:8}}>
                  🏆 Tableau d'Honneur — 5 meilleurs élèves
                </div>
                <Card style={{borderRadius:"0 0 10px 10px"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"#fef3e0"}}>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Rang</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e"}}>Élève</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e"}}>Classe</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Moyenne</th>
                      <th style={{padding:"8px 12px",fontSize:11,fontWeight:700,color:"#92400e",textAlign:"center"}}>Mention</th>
                    </tr></thead>
                    <tbody>{classement.map((e,i)=>{
                      const medals=["🥇","🥈","🥉","4️⃣","5️⃣"];
                      const moy=e.moyGene.toFixed(2);
                      const mention=Number(moy)>=16?"Très Bien":Number(moy)>=14?"Bien":Number(moy)>=12?"Assez Bien":Number(moy)>=10?"Passable":"Insuffisant";
                      const mentionColor=Number(moy)>=14?"vert":Number(moy)>=10?"blue":"red";
                      return <tr key={e._id} style={{borderBottom:"1px solid #fde68a",background:i===0?"#fffbeb":"#fff"}}>
                        <td style={{padding:"9px 12px",textAlign:"center",fontSize:20}}>{medals[i]}</td>
                        <td style={{padding:"9px 12px",fontWeight:800,color:C.blueDark}}>{e.nom} {e.prenom}</td>
                        <td style={{padding:"9px 12px"}}><Badge color="blue">{e.classe}</Badge></td>
                        <td style={{padding:"9px 12px",textAlign:"center",fontSize:16,fontWeight:800,color:C.greenDk}}>{moy}/20</td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}><Badge color={mentionColor}>{mention}</Badge></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </Card>
              </div>
            );
          })()}
        </div>}

      {/* ── CLASSES ── */}
      {tab==="classes"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Classes ({classes.length})</strong>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {canCreate&&<Btn v="ghost" onClick={async()=>{
              const classesEleves=[...new Set(eleves.map(e=>e.classe).filter(Boolean))];
              const titulairesParClasse={};
              ens.forEach(e=>{
                if(e.classeTitle){
                  titulairesParClasse[e.classeTitle]=`${e.prenom||""} ${e.nom||""}`.trim();
                }
              });
              const classesEns=Object.keys(titulairesParClasse);
              const toutesClasses=[...new Set([...classesEleves,...classesEns])];
              let nbCrees=0, nbMaj=0;
              for(const nom of toutesClasses){
                const existante=classes.find(c=>c.nom===nom);
                const titulaire=titulairesParClasse[nom]||"";
                if(!existante){
                  await ajC({nom, effectif:0, ...(titulaire?{enseignant:titulaire}:{})});
                  nbCrees++;
                } else if(titulaire && !existante.enseignant){
                  await modC({...existante, enseignant:titulaire});
                  nbMaj++;
                }
              }
              toast(`Synchronisation : ${nbCrees} classe(s) créée(s), ${nbMaj} mise(s) à jour.`, "success");
            }}>🔄 Synchroniser depuis élèves & enseignants</Btn>}
            {canCreate&&<Btn onClick={()=>{setForm({});setModal("add_c");}}>+ Nouvelle classe</Btn>}
          </div>
        </div>
        {cC?<Chargement/>:classes.length===0?<Vide icone="🏫" msg="Aucune classe"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Classe","Effectif","Enseignant Principal","Salle","Imprimer liste",canEdit?"Actions":""]}/>
            <tbody>{classes.map(c=><TR key={c._id}>
              <TD bold>{c.nom}</TD><TD><Badge color="blue">{effectifReel(c.nom)} élèves</Badge></TD>
              <TD>{c.enseignant}</TD><TD>{c.salle}</TD>
              <TD><Btn sm v="ghost" onClick={()=>imprimerListeClasse(c.nom,eleves,schoolInfo)}>🖨️ Imprimer</Btn></TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...c});setModal("edit_c");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supC(c._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {(modal==="add_c"&&canCreate||(modal==="edit_c"&&canEdit))&&<Modale titre={modal==="add_c"?"Nouvelle classe":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
            <Champ label="Nom de la classe">
              <input value={form.nom||""} onChange={chg("nom")}
                style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",marginBottom:8}}
                placeholder="Saisir ou cliquer sur une classe prédéfinie"/>
              <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 5px"}}>Classes prédéfinies — cliquez pour sélectionner :</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {(classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c)).map(c=>(
                  <button key={c} onClick={()=>setForm(p=>({...p,nom:c}))}
                    style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700,cursor:"pointer",
                      background:form.nom===c?C.green:"#e0ebf8",color:form.nom===c?"#fff":C.blue,border:"none"}}>
                    {c}
                  </button>
                ))}
                {(classesPredefinies||[]).filter(c=>!classes.find(cl=>cl.nom===c)).length===0&&
                  <span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Toutes les classes prédéfinies sont déjà créées.</span>}
              </div>
            </Champ>
          </div>
            <Input label="Effectif" type="number" value={form.effectif||""} onChange={chg("effectif")}/>
            <Input label="Enseignant Principal" value={form.enseignant||""} onChange={chg("enseignant")}/>
            <Input label="Salle" value={form.salle||""} onChange={chg("salle")}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={saveClasse}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── ÉLÈVES (lecture seule — enrôlement dans Comptabilité) ── */}
      {tab==="eleves"&&<div>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Élèves ({eleves.length})</strong>
          <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
            <option value="all">Toutes les classes</option>
            {classesUniq.map(c=><option key={c}>{c}</option>)}
          </select>
          {filtreClasse!=="all"&&<Btn sm v="ghost" onClick={()=>imprimerListeClasse(filtreClasse,eleves,schoolInfo)}>🖨️ Imprimer liste</Btn>}
          <Btn sm v="blue" onClick={()=>imprimerCartesEleves(elevesFiltres,schoolInfo,annee)}>🪪 Cartes ID</Btn>
          <Btn sm v="ghost" onClick={()=>exportExcel(
            `Eleves_${avecEns?"College":"Primaire"}`,
            ["Matricule","IEN","Nom","Prénom","Classe","Sexe","Date Naissance","Lieu Naissance","Filiation","Tuteur","Contact","Domicile","Statut"],
            elevesFiltres.map(e=>[e.matricule||"",e.ien||"",e.nom,e.prenom,e.classe,e.sexe||"",e.dateNaissance||"",e.lieuNaissance||"",e.filiation||"",e.tuteur||"",e.contactTuteur||"",e.domicile||"",e.statut||"Actif"])
          )}>📥 Export Excel</Btn>
        </div>
        {cE?<Chargement/>:elevesFiltres.length===0?<Vide icone="🎓" msg="Aucun élève"/>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
              <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Date Nais.","Lieu Nais.","Filiation","Tuteur","Contact","Domicile","Documents","Statut","Accès"]}/>
              <tbody>{elevesFiltres.map(e=><TR key={e._id}>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
                <TD bold>{e.nom} {e.prenom}</TD><TD>{e.classe}</TD>
                <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
                <TD>{e.dateNaissance||"—"}</TD>
                <TD>{e.lieuNaissance||"—"}</TD>
                <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
                <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
                <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
                <TD>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {(e.fichiers||[]).map((f,i)=>(
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,background:"#e0ebf8",padding:"2px 6px",borderRadius:4}}>📎 {f.nom}</a>
                    ))}
                    {(e.fichiers||[]).length===0&&<span style={{fontSize:11,color:"#9ca3af"}}>—</span>}
                  </div>
                </TD>
                <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut}</Badge></TD>
                <TD>
                  {canEdit&&<Btn sm v="purple" onClick={()=>{
                    const loginSuggere=`parent.${(e.nom||"").toLowerCase().replace(/\s+/g,"").slice(0,12)}`;
                    setParentEleve(e);
                    setFormP({login:loginSuggere, mdp:genererMdp()});
                  }}>👨‍👩‍👧 Compte</Btn>}
                </TD>

              </TR>)}</tbody>
            </table>
          </div>}

      {/* Modal creation compte parent */}
      {parentEleve&&<Modale titre={`Compte parent - ${parentEleve.prenom} ${parentEleve.nom}`} fermer={()=>setParentEleve(null)}>
        <div style={{marginBottom:14,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:18}}>Tuteur</span>
          <span><strong>{parentEleve.prenom} {parentEleve.nom}</strong> - Classe {parentEleve.classe} - Tuteur : {parentEleve.tuteur||"-"}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
          <Input label="Identifiant de connexion" value={formP.login||""} onChange={chgP("login")} placeholder="ex: parent.dupont"/>
          <Champ label="Mot de passe initial">
            <div style={{display:"flex",gap:8}}>
              <input value={formP.mdp||""} onChange={chgP("mdp")}
                style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
              <Btn sm v="ghost" onClick={()=>setFormP(p=>({...p,mdp:genererMdp()}))}>Regenerer</Btn>
            </div>
          </Champ>
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
          Notez ces identifiants avant de valider. Si un compte parent existe deja pour le meme tuteur et la meme filiation, l'eleve sera rattache a ce compte.
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setParentEleve(null)}>Annuler</Btn>
          <Btn v="purple" onClick={async()=>{
            if(!formP.login?.trim()){toast("Identifiant requis.","warning");return;}
            if(!formP.mdp||formP.mdp.length<8){toast("Mot de passe minimum 8 caracteres.","warning");return;}
            try{
              const section=cleEleves.includes("Primaire")?"primaire":cleEleves.includes("Lycee")?"lycee":"college";
              const headers = await getAuthHeaders({"Content-Type":"application/json"});
              const res = await apiFetch("/account-manage",{
                method:"POST",
                headers,
                body:JSON.stringify({
                  action:"create",
                  schoolId,
                  login:formP.login.trim().toLowerCase(),
                  mdp:formP.mdp,
                  role:"parent",
                  label:"Parent",
                  nom:(parentEleve.tuteur||`Parent de ${parentEleve.prenom}`),
                  eleveId:parentEleve._id,
                  eleveNom:`${parentEleve.prenom} ${parentEleve.nom}`,
                  eleveClasse:parentEleve.classe||"",
                  section,
                  sections:[section],
                  eleveIds:[parentEleve._id],
                  elevesAssocies:[{
                    eleveId:parentEleve._id,
                    eleveNom:`${parentEleve.prenom} ${parentEleve.nom}`,
                    eleveClasse:parentEleve.classe||"",
                    section,
                  }],
                  tuteur:parentEleve.tuteur||"",
                  contactTuteur:parentEleve.contactTuteur||"",
                  filiation:parentEleve.filiation||"",
                  statut:"Actif",
                }),
              });
              const data = await res.json().catch(()=>({}));
              if(!res.ok||!data.ok) throw new Error(data.error||"Creation du compte impossible.");
              const loginUtilise = data.compte?.login || formP.login;
              if(data.merged || data.mergedIntoExisting){
                toast(`${parentEleve.prenom} a ete rattache au compte parent ${loginUtilise}. Le mot de passe actuel est conserve.`,"success");
                logAction("Eleve rattache compte parent",`Login: ${loginUtilise} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
              } else {
                toast(`Compte parent cree - ID : ${loginUtilise}. Remettez-le au tuteur de ${parentEleve.prenom}.`,"success");
                logAction("Compte parent cree",`Login: ${loginUtilise} - Eleve: ${parentEleve.prenom} ${parentEleve.nom}`);
              }
              setParentEleve(null);
            }catch(e){toast("Erreur : "+e.message,"error");}
          }}>Creer le compte</Btn>
        </div>
      </Modale>}

      </div>}

      {/* ── ENSEIGNANTS ── */}
      {tab==="ens"&&avecEns&&(()=>{
        const sectionEns = cleEns.includes("Lycee")?"lycee":cleEns.includes("College")?"college":"primaire";

        const creerCompteEns = async () => {
          if(!formC.login?.trim()){toast("Identifiant requis.","warning");return;}
          if(!formC.mdp||formC.mdp.length<8){toast("Mot de passe minimum 8 caractères.","warning");return;}
          try{
            const nomComplet=`${ensCompte.prenom||""} ${ensCompte.nom||""}`.trim();
            const headers = await getAuthHeaders({"Content-Type":"application/json"});
              const res = await apiFetch("/account-manage",{
              method:"POST",
              headers,
                body:JSON.stringify({
                  action:"create",
                  schoolId,
                  login:formC.login.trim().toLowerCase(),
                  mdp:formC.mdp,
                  role:"enseignant",
                  label:"Enseignant",
                  nom:nomComplet,
                  enseignantId:ensCompte._id,
                  enseignantNom:nomComplet,
                  section:sectionEns,
                  sections:[sectionEns],
                  matiere:ensCompte.matiere||"",
                  statut:"Actif",
                }),
            });
            const data = await res.json().catch(()=>({}));
            if(!res.ok||!data.ok) throw new Error(data.error||"Création du compte impossible.");
            toast(`Compte enseignant créé — ID : ${formC.login} · L'enseignant changera son mot de passe à la 1ère connexion.`,"success");
            logAction("Compte enseignant créé",`Login: ${formC.login} · ${nomComplet}`);
            setEnsCompte(null);
          }catch(e){toast("Erreur : "+e.message,"error");}
        };

        return <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <strong style={{fontSize:14,color:C.blueDark}}>Corps enseignant ({ens.length})</strong>
            {canCreate&&<Btn onClick={()=>{setForm({statut:"Titulaire"});setModal("add_ens");}}>+ Ajouter</Btn>}
          </div>
          {cEns?<Chargement/>:ens.length===0?<Vide icone="👨‍🏫" msg="Aucun enseignant"/>
            :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:10}}>
              {ens.map(e=><Card key={e._id}><div style={{padding:"14px 15px"}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
                  <div style={{width:38,height:38,borderRadius:8,background:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:"#fff"}}>
                    {(e.prenom||"?")[0]}{(e.nom||"?")[0]}
                  </div>
                  <Badge color={e.statut==="Titulaire"?"vert":"amber"}>{e.statut}</Badge>
                </div>
                <p style={{margin:"0 0 1px",fontWeight:800,fontSize:13,color:C.blueDark}}>{e.prenom} {e.nom}</p>
                <p style={{margin:"0 0 4px",fontSize:12,color:couleur,fontWeight:700}}>
                  {isPrimarySection
                    ? `Forfait ${Number(getTeacherMonthlyForfait(e) || 0).toLocaleString("fr-FR")} GNF`
                    : e.matiere}
                </p>
                <p style={{margin:0,fontSize:11,color:"#9ca3af"}}>{e.grade} · {e.telephone}</p>
                {(e.fichiers||[]).length>0&&<div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                  {e.fichiers.map((f,i)=><a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:C.blue,background:"#e0ebf8",padding:"2px 5px",borderRadius:3}}>📎 {f.nom}</a>)}
                </div>}
                {canEdit&&<div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                  <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens");}}>✏️ Modifier</Btn>
                  <Btn sm v="purple" onClick={()=>{
                    const loginSuggere=`${(e.prenom||"").toLowerCase().replace(/\s+/g,"")}${e.nom?"."+e.nom.toLowerCase().replace(/\s+/g,""):""}`;
                    setEnsCompte(e);
                    setFormC({login:loginSuggere,mdp:genererMdp()});
                  }}>🔑 Compte</Btn>
                  <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEns(e._id);}}>🗑</Btn>
                </div>}
              </div></Card>)}
            </div>}

          {/* Modal compte enseignant */}
          {ensCompte&&<Modale titre={`Compte — ${ensCompte.prenom} ${ensCompte.nom}`} fermer={()=>setEnsCompte(null)}>
            <div style={{marginBottom:14,padding:"10px 14px",background:"#f5f3ff",borderRadius:10,fontSize:12,color:"#6d28d9"}}>
              <strong>Section :</strong> {sectionEns} &nbsp;|&nbsp; <strong>Matière :</strong> {ensCompte.matiere||"—"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
              <Input label="Identifiant de connexion" value={formC.login||""} onChange={chgC("login")} placeholder="ex: jean.dupont"/>
              <Champ label="Mot de passe initial">
                <div style={{display:"flex",gap:8}}>
                  <input value={formC.mdp||""} onChange={chgC("mdp")}
                    style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"#fafbfc",outline:"none"}}/>
                  <Btn sm v="ghost" onClick={()=>setFormC(p=>({...p,mdp:genererMdp()}))}>🔄 Générer</Btn>
                </div>
              </Champ>
            </div>
            <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e"}}>
              ⚠️ Notez ces identifiants avant de valider — le mot de passe ne sera plus visible ensuite.
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <Btn v="ghost" onClick={()=>setEnsCompte(null)}>Annuler</Btn>
              <Btn v="purple" onClick={creerCompteEns}>✅ Créer le compte</Btn>
            </div>
          </Modale>}

          {(modal==="add_ens"&&canCreate||(modal==="edit_ens"&&canEdit))&&<Modale titre={modal==="add_ens"?"Nouvel enseignant":"Modifier"} fermer={()=>setModal(null)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
              <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
              <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
              <Input label="Grade" value={form.grade||""} onChange={chg("grade")}/>
              <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
              <Selec label="Statut" value={form.statut||"Titulaire"} onChange={chg("statut")}>
                <option>Titulaire</option><option>Contractuel</option><option>Vacataire</option>
              </Selec>
              <div style={{gridColumn:"1/-1"}}>
                <Input label="Classe (titulaire)" value={form.classeTitle||""} onChange={chg("classeTitle")} placeholder="Ex : 3ème Année A — laissez vide si non titulaire"/>
              </div>
            </div>
            <div style={{marginTop:14,padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af"}}>
              <strong>Paie gérée par la Comptabilité.</strong> Les forfaits, primes horaires et primes par classe se renseignent dans <em>Comptabilité &gt; Enseignants</em>.
            </div>
            <UploadFichiers dossier={`enseignants/${cleEns}`} fichiers={form.fichiers||[]}
              onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
              onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
              <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
              <Btn onClick={saveEnseignant}>Enregistrer</Btn>
            </div>
          </Modale>}
        </div>;
      })()}

      {/* ── NOTES ── */}
      {tab==="notes"&&<div>
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
            notes.map(n=>[n.eleveNom,n.matiere,n.type,n.periode,n.note])
          )}>📥 Export</Btn>
          <Btn sm v="ghost" onClick={()=>exportExcel(`Modele_Notes`,
            ["Élève (Nom Prénom)","Matière","Type","Période",`Note (/${maxNote})`],
            eleves.slice(0,3).map(e=>[`${e.nom} ${e.prenom}`,matieres[0]?.nom||"Maths","Devoir","T1",Math.round(maxNote*0.7)])
          )}>📋 Modèle</Btn>
          {canCreate&&<Btn sm v="vert" onClick={()=>setModal("import_notes")}>⬆️ Importer</Btn>}
          {canCreate&&<Btn onClick={()=>{setForm({periode:"T1",type:"Devoir"});setModal("add_n");}}>+ Saisir</Btn>}
        </div>

        {/* ── VUE GRILLE ── */}
        {notesVue==="grille"&&(()=>{
          const classesUniqN = [...new Set(eleves.map(e=>e.classe||""))].filter(Boolean).sort();
          const elevesGrille = (grilleClasse==="all"?eleves:eleves.filter(e=>e.classe===grilleClasse))
            .filter(e=>e.statut==="Actif"||!e.statut)
            .sort((a,b)=>(a.nom+a.prenom).localeCompare(b.nom+b.prenom));
          // Filtre les matières selon la classe sélectionnée dans la grille
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
              if(exist){ /* modifier */ await ajN({...exist,note:Number(val)}); }
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
                  <option>Devoir</option><option>Interrogation</option><option>Examen</option><option>Composition</option>
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
              <TD><Badge color="gray">{n.type}</Badge></TD><TD>{n.periode}</TD>
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
            const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:""}).slice(1); // skip header
            const lignes = rows.filter(r=>r[0]||r[1]).map((r,i)=>{
              const eleveNom = String(r[0]||"").trim();
              const matiere  = String(r[1]||"").trim();
              const type     = String(r[2]||"Devoir").trim();
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
                    <td style={{padding:"4px 8px"}}>{l.type}</td>
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
            <Selec label="Type" value={form.type||"Devoir"} onChange={chg("type")}>
              <option>Devoir</option><option>Interrogation</option><option>Examen</option><option>Composition</option>
            </Selec>
            <Input label={`Note (/${maxNote})`} type="number" min="0" max={maxNote} step="0.25" value={form.note||""} onChange={chg("note")}/>
            <Selec label="Période" value={form.periode||"T1"} onChange={chg("periode")}>
              <option>T1</option><option>T2</option><option>T3</option>
            </Selec>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{ajN({...form,note:Number(form.note)});setModal(null);}}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── ENSEIGNEMENTS ── */}
      {tab==="enseignements"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Gestion des Enseignements ({enseignements.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({type:"Cours",statut:"Effectué"});setModal("add_eng");}}>+ Enregistrer</Btn>}
        </div>

        {/* Stats rapides */}
        {enseignements.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:14}}>
          {[
            {label:"Cours effectués",val:enseignements.filter(e=>e.statut==="Effectué").length,bg:"#eaf4e0",c:C.greenDk},
            {label:"Absences enseignants",val:enseignements.filter(e=>e.statut==="Absent").length,bg:"#fce8e8",c:"#b91c1c"},
            {label:"Retards",val:enseignements.filter(e=>e.statut==="Retard").length,bg:"#fef3e0",c:"#d97706"},
            {label:"Cours non effectués",val:enseignements.filter(e=>e.statut==="Non effectué").length,bg:"#e6f4ea",c:C.blue},
          ].map(s=><div key={s.label} style={{background:s.bg,borderRadius:9,padding:"10px 14px",border:"1px solid #e8eaed"}}>
            <p style={{fontSize:10,fontWeight:700,color:s.c,textTransform:"uppercase",margin:"0 0 2px",letterSpacing:"0.06em"}}>{s.label}</p>
            <p style={{fontSize:22,fontWeight:800,color:s.c,margin:0}}>{s.val}</p>
          </div>)}
        </div>}

        {cEng?<Chargement/>:enseignements.length===0?<Vide icone="📚" msg="Aucun enseignement enregistré"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Enseignant","Matière","Classe","Date","Heure","Type","Statut","Observation",canEdit?"Actions":""]}/>
            <tbody>{enseignements.sort((a,b)=>b.date>a.date?1:-1).map(e=><TR key={e._id}>
              <TD bold>{e.enseignantNom}</TD>
              <TD>{e.matiere}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD>{e.date}</TD>
              <TD>{e.heure||"—"}</TD>
              <TD><Badge color="gray">{e.type}</Badge></TD>
              <TD><Badge color={
                e.statut==="Effectué"?"vert":
                e.statut==="Absent"?"red":
                e.statut==="Retard"?"amber":"purple"
              }>{e.statut}</Badge></TD>
              <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.observation||"—"}</span></TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_eng");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEng(e._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}

        {(modal==="add_eng"&&canCreate||(modal==="edit_eng"&&canEdit))&&<Modale titre={modal==="add_eng"?"Enregistrer un enseignement":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <Selec label="Enseignant" value={form.enseignantNom||""} onChange={chg("enseignantNom")}>
                <option value="">— Sélectionner —</option>
                {ens.map(e=><option key={e._id}>{e.prenom} {e.nom}</option>)}
              </Selec>
            </div>
            <Selec label="Matière" value={form.matiere||""} onChange={chg("matiere")}>
              <option value="">—</option>
              {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
            </Selec>
            <Selec label="Classe" value={form.classe||""} onChange={chg("classe")}>
              <option value="">—</option>
              {classes.map(c=><option key={c._id}>{c.nom}</option>)}
            </Selec>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Input label="Heure" type="time" value={form.heure||""} onChange={chg("heure")}/>
            <Selec label="Type" value={form.type||"Cours"} onChange={chg("type")}>
              <option>Cours</option>
              <option>Composition</option>
              <option>Devoir surveillé</option>
              <option>Correction</option>
            </Selec>
            <Selec label="Statut" value={form.statut||"Effectué"} onChange={chg("statut")}>
              <option>Effectué</option>
              <option>Absent</option>
              <option>Retard</option>
              <option>Non effectué</option>
            </Selec>
            <div style={{gridColumn:"1/-1"}}><Textarea label="Observation" value={form.observation||""} onChange={chg("observation")}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{
              const r={...form,date:form.date||today()};
              if(modal==="add_eng")ajEng(r);else modEng(r);
              setModal(null);
            }}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── DISCIPLINE ── */}
      {tab==="discipline"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Discipline & Absences ({absences.length})</strong>
          <Btn sm v="ghost" onClick={()=>exportExcel(
            `Discipline_${avecEns?"College":"Primaire"}`,
            ["Élève","Classe","Type","Date","Motif","Justifié"],
            absences.map(a=>[a.eleveNom,a.classe,a.type,a.date,a.motif||"",a.justifie])
          )}>📥 Export Excel</Btn>
          {canCreate&&<Btn onClick={()=>{setForm({type:"Absence",justifie:"Non"});setModal("add_abs");}}>+ Enregistrer</Btn>}
        </div>
        {(()=>{
          const elevesAlerte=eleves.map(e=>({
            ...e,
            nbAbs:absences.filter(a=>a.eleveNom===`${e.nom} ${e.prenom}`&&a.type==="Absence"&&a.justifie==="Non").length
          })).filter(e=>e.nbAbs>=3).sort((a,b)=>b.nbAbs-a.nbAbs);
          return elevesAlerte.length>0?(
            <div style={{background:"#fef3e0",border:"1px solid #fbbf24",borderRadius:10,padding:"12px 16px",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>⚠️</span>
                <strong style={{fontSize:13,color:"#92400e"}}>Alertes absences — {elevesAlerte.length} élève(s) avec 3 absences non justifiées ou plus</strong>
                <Btn sm v="ghost" style={{marginLeft:"auto"}} onClick={()=>exportExcel(
                  "Alertes_Absences",
                  ["Nom","Prénom","Classe","Nb absences non justifiées","Tuteur","Contact"],
                  elevesAlerte.map(e=>[e.nom,e.prenom,e.classe,e.nbAbs,e.tuteur||"",e.contactTuteur||""])
                )}>📥 Exporter</Btn>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {elevesAlerte.map(e=>(
                  <div key={e._id} style={{background:"#fff",border:"1px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12}}>
                    <span style={{fontWeight:800,color:"#92400e"}}>{e.nom} {e.prenom}</span>
                    <span style={{color:"#6b7280"}}> · {e.classe} · </span>
                    <Badge color="amber">{e.nbAbs} absences</Badge>
                  </div>
                ))}
              </div>
            </div>
          ):null;
        })()}
        {cAbs?<Chargement/>:absences.length===0?<Vide icone="📋" msg="Aucun événement de discipline enregistré"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Élève","Classe","Type","Date","Motif","Justifié",canEdit?"Action":""]}/>
            <tbody>{absences.map(a=><TR key={a._id}>
              <TD bold>{a.eleveNom}</TD><TD>{a.classe}</TD>
              <TD><Badge color={a.type==="Absence"?"red":a.type==="Retard"?"amber":"orange"}>{a.type}</Badge></TD>
              <TD>{a.date}</TD><TD>{a.motif||"—"}</TD>
              <TD><Badge color={a.justifie==="Oui"?"vert":"red"}>{a.justifie}</Badge></TD>
              {canEdit&&<TD><Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supAbs(a._id);}}>Suppr.</Btn></TD>}
            </TR>)}</tbody>
          </table></Card>}
        {modal==="add_abs"&&canCreate&&<Modale titre="Enregistrer un événement disciplinaire" fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}>
              <Selec label="Élève" value={form.eleveNom||""} onChange={e=>{
                const el=eleves.find(ev=>`${ev.nom} ${ev.prenom}`===e.target.value);
                setForm(p=>({...p,eleveNom:e.target.value,classe:el?.classe||""}));
              }}>
                <option value="">— Sélectionner —</option>
                {eleves.map(e=><option key={e._id}>{e.nom} {e.prenom}</option>)}
              </Selec>
            </div>
            <Selec label="Type" value={form.type||"Absence"} onChange={chg("type")}>
              <option>Absence</option><option>Retard</option><option>Sanction</option><option>Avertissement</option><option>Renvoi temporaire</option>
            </Selec>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Selec label="Justifié ?" value={form.justifie||"Non"} onChange={chg("justifie")}>
              <option>Non</option><option>Oui</option>
            </Selec>
            <div style={{gridColumn:"1/-1"}}><Textarea label="Motif / Description" value={form.motif||""} onChange={chg("motif")}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn v="orange" onClick={async()=>{
              const abs={...form,date:form.date||today()};
              await ajAbs(abs);
              setModal(null);
              envoyerPush(
                ["parent"],
                `⚠️ ${abs.type||"Absence"} signalée`,
                `${abs.eleveNom||"Votre enfant"} — ${abs.type||"Absence"} du ${abs.date}${abs.motif?` : ${abs.motif}`:""}`,
                "/absences"
              );
            }}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {/* ── BULLETINS ── */}
      {tab==="bulletins"&&<div>
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
            const elevesB=elevesFiltres
              .filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()))
              .filter(e=>!(!!schoolInfo.blocageParentImpaye && moisAnnee.filter(m=>(e.mens||{})[m]!=="Payé").length>0));
            imprimerBulletinsGroupes(elevesB,notes,matieres,periodeB,avecEns?"college":"primaire",maxNote,schoolInfo,filtreClasse==="all"?"Toutes classes":filtreClasse,matieresForClasse,appreciationsParEleveB(periodeB));
          }}>
            📄 Tous les bulletins {filtreClasse!=="all"?`— ${filtreClasse}`:""}
          </Btn>
        </div>
        {(()=>{
          const elevesB=elevesFiltres.filter(e=>!rechercheMatricule||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));
          return elevesB.length===0?<Vide icone="📊" msg="Aucun élève pour cette sélection"/>
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
          </table></Card>;
        })()}

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
      </div>}

      {/* ── LIVRETS ── */}
      {tab==="livrets"&&<LivretsTab
        cleEleves={cleEleves} cleNotes={cleNotes}
        matieres={matieres} maxNote={maxNote}
        userRole={userRole} annee={annee}
      />}

      {/* ── MATIÈRES ── */}
      {tab==="matieres"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Matières et coefficients ({matieres.length})</strong>
          {canCreate&&<Btn onClick={()=>{setForm({coefficient:1});setModal("add_mat");}}>+ Ajouter</Btn>}
        </div>
        {canCreate&&matieres.length===0&&matieresPredefinies.length>0&&<div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"12px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:16}}>💡</span>
          <span style={{fontSize:13,color:"#166534",flex:1}}>Des matières prédéfinies sont disponibles pour ce niveau.</span>
          <Btn v="success" onClick={()=>matieresPredefinies.forEach(m=>ajMat(m))}>✅ Initialiser les matières</Btn>
        </div>}
        {/* Légende */}
        <div style={{background:"#f0f7ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"9px 14px",marginBottom:12,fontSize:12,color:"#1e40af"}}>
          💡 Si une matière n'est assignée à <strong>aucune classe</strong>, elle apparaît dans <strong>toutes les classes</strong>. Sinon, elle n'apparaît que dans les classes sélectionnées.
        </div>
        {cMat?<Chargement/>:matieres.length===0?<Vide icone="📚" msg="Ajoutez les matières pour calculer les bulletins"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Matière","Coefficient","Classes concernées",canEdit?"Actions":""]}/>
            <tbody>{matieres.map(m=><TR key={m._id}>
              <TD bold>{m.nom}</TD>
              <TD><Badge color="blue">Coef. {m.coefficient}</Badge></TD>
              <TD>
                {!m.classes||!m.classes.length
                  ? <span style={{color:"#9ca3af",fontSize:11,fontStyle:"italic"}}>Toutes les classes</span>
                  : <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {m.classes.map(c=><span key={c} style={{background:"#ede9fe",color:"#6d28d9",padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700}}>{c}</span>)}
                    </div>}
              </TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...m,classesEdit:[...(m.classes||[])]});setModal("edit_mat_"+m._id);}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supMat(m._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}

        {/* Modal ajout matière */}
        {modal==="add_mat"&&canCreate&&<Modale titre="Nouvelle matière" fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <Input label="Nom de la matière" value={form.nom||""} onChange={chg("nom")}/>
            <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
              Classes (laisser vide = toutes les classes)
            </label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {classes.map(c=>{
                const sel=(form.classesEdit||[]).includes(c.nom);
                return <button key={c._id} type="button"
                  onClick={()=>setForm(p=>({...p,classesEdit:sel?(p.classesEdit||[]).filter(x=>x!==c.nom):[...(p.classesEdit||[]),c.nom]}))}
                  style={{padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?"#8b5cf6":"#e5e7eb"}`,
                    background:sel?"#ede9fe":"#f9fafb",color:sel?"#6d28d9":"#6b7280",
                    fontWeight:sel?700:400,fontSize:12,cursor:"pointer"}}>
                  {c.nom}
                </button>;
              })}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{ajMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[]});setModal(null);}}>Enregistrer</Btn>
          </div>
        </Modale>}

        {/* Modal modification matière (classes assignées) */}
        {modal&&modal.startsWith("edit_mat_")&&canEdit&&(()=>{
          const matId=modal.replace("edit_mat_","");
          const mat=matieres.find(m=>m._id===matId);
          if(!mat)return null;
          return <Modale titre={`Modifier — ${mat.nom}`} fermer={()=>setModal(null)}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
              <Input label="Coefficient" type="number" min="1" value={form.coefficient||1} onChange={chg("coefficient")}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>
                Classes concernées (laisser vide = toutes les classes)
              </label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {classes.map(c=>{
                  const sel=(form.classesEdit||[]).includes(c.nom);
                  return <button key={c._id} type="button"
                    onClick={()=>setForm(p=>({...p,classesEdit:sel?(p.classesEdit||[]).filter(x=>x!==c.nom):[...(p.classesEdit||[]),c.nom]}))}
                    style={{padding:"5px 12px",borderRadius:20,border:`2px solid ${sel?"#8b5cf6":"#e5e7eb"}`,
                      background:sel?"#ede9fe":"#f9fafb",color:sel?"#6d28d9":"#6b7280",
                      fontWeight:sel?700:400,fontSize:12,cursor:"pointer"}}>
                    {c.nom}
                  </button>;
                })}
              </div>
              {!(form.classesEdit||[]).length&&<p style={{margin:"8px 0 0",fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Aucune sélection → s'applique à toutes les classes</p>}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
              <Btn onClick={()=>{
                modMat ? modMat({...form,coefficient:Number(form.coefficient||1),classes:form.classesEdit||[],_id:matId}) : null;
                setModal(null);
              }}>💾 Enregistrer</Btn>
            </div>
          </Modale>;
        })()}
      </div>}

      {/* ── EMPLOIS DU TEMPS — GRILLE VISUELLE ── */}
      {tab==="emploidutemps"&&avecEns&&(()=>{
        const JOURS=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
        const genTranches=(step)=>{
          const [sh,sm]=(edtHeureDebut||"08:00").split(":").map(Number);
          const [eh,em]=(edtHeureFin||"14:00").split(":").map(Number);
          const t=[];let h=sh,m=sm;
          while(h*60+m<=eh*60+em){t.push(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));m+=step;h+=Math.floor(m/60);m=m%60;}
          return t;
        };
        const duree=maxNote===10?edtDuree:120; // secondaire toujours 2h
        const TRANCHES=genTranches(duree);
        const COULEURS=["#dbeafe","#dcfce7","#fef9c3","#ffe4e6","#f3e8ff","#ffedd5","#e0f2fe","#d1fae5","#fce7f3","#ecfdf5"];
        // ── Tri des classes par niveau scolaire ──
        const NIVEAUX_ORDER=[
          "maternelle","ps","ms","gs","petite section","moyenne section","grande section",
          "cp","cp1","cp2",
          "ce","ce1","ce2",
          "cm","cm1","cm2",
          "6ème","6e","6","6eme",
          "5ème","5e","5","5eme",
          "4ème","4e","4","4eme",
          "3ème","3e","3","3eme",
          "7ème","7e","7","7eme",
          "8ème","8e","8","8eme",
          "9ème","9e","9","9eme",
          "10ème","10e","10","10eme",
          "11ème","11e","11","11eme",
          "seconde","2nde","2nd",
          "12ème","12e","12","12eme",
          "première","premiere","1ère","1ere",
          "13ème","13e","13","13eme",
          "terminale","tle","term",
        ];
        const niveauRank=(nom)=>{
          const n=(nom||"").toLowerCase().trim();
          const idx=NIVEAUX_ORDER.findIndex(o=>n===o||n.startsWith(o+" ")||n.startsWith(o+"-")||n.startsWith(o+"_"));
          if(idx>=0)return idx*10;
          const m=n.match(/^(\d+)/);
          if(m)return 500+parseInt(m[1]);
          return 999;
        };
        const classesTriees=[...classes].sort((a,b)=>niveauRank(a.nom)-niveauRank(b.nom));
        const classeEdtActuelle = filtreClasse==="all"&&classesTriees.length>0 ? classesTriees[0].nom : filtreClasse;
        const matCouleur={};
        matieres.forEach((m,i)=>{matCouleur[m.nom]=COULEURS[i%COULEURS.length];});
        // Lookup enseignant par nom stocké (supporte ancien format "Prénom Nom (matière)" et nouveau "Prénom Nom")
        const findEns=(nomStr)=>ens.find(e=>{
          if(!nomStr)return false;
          const full=`${e.prenom||""} ${e.nom||""}`.trim();
          return nomStr===full||nomStr.startsWith(full+" (");
        });
        // Nom affiché sans la partie "(matière)" si présente
        const affNom=(nomStr)=>nomStr?nomStr.replace(/\s*\([^)]*\)$/,""):"";
        const emploisClasse=emplois.filter(e=>e.classe===classeEdtActuelle);
        const getCreneau=(jour,hd)=>emploisClasse.find(e=>e.jour===jour&&e.heureDebut===hd);
        const imprimerEDT=()=>{
          const couleursBg=["#dbeafe","#dcfce7","#fef9c3","#ffe4e6","#f3e8ff","#ffedd5","#e0f2fe","#d1fae5","#fce7f3","#ecfdf5"];
          const allMat=[...new Set(emploisClasse.map(e=>e.matiere).filter(Boolean))];
          const mc={};allMat.forEach((m,i)=>{mc[m]=couleursBg[i%couleursBg.length];});
          const getCr=(jour,hd)=>emploisClasse.find(e=>e.jour===jour&&e.heureDebut===hd);
          const ths=JOURS.map(j=>"<th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;text-align:center;min-width:80px'>"+j+"</th>").join("");
          const rows=TRANCHES.slice(0,-1).map((_,i)=>{
            const hd=TRANCHES[i],hf=TRANCHES[i+1];
            const tds=JOURS.map(jour=>{
              const cr=getCr(jour,hd);
              if(!cr)return "<td style='background:#fafcff;border:1px solid #e2e8f0;padding:6px'></td>";
              const isRev=cr.type==="revision";
              const bg=isRev?"#fff7ed":(mc[cr.matiere]||"#e0ebf8");
              const borderColor=isRev?"#fdba74":"#e2e8f0";
              const ensObj=findEns(cr.enseignant);
              return "<td style='background:"+bg+";border:1px solid "+borderColor+";padding:6px;vertical-align:top'>"
                +(isRev?"<span style='background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:1px 4px;border-radius:3px;display:inline-block;margin-bottom:2px'>RÉV</span><br>":"")
                +"<b style='font-size:11px;color:"+(isRev?"#9a3412":"#1e3a5f")+";display:block'>"+cr.matiere+"</b>"
                +(cr.enseignant?"<span style='font-size:10px;color:#475569'>"+affNom(cr.enseignant)+"</span>":"")
                +(ensObj?.telephone?"<br><span style='font-size:9px;color:#00876a;font-weight:600'>"+ensObj.telephone+"</span>":"")
                +(cr.salle?"<br><span style='font-size:9px;color:#94a3b8'>📍"+cr.salle+"</span>":"")
                +"</td>";
            }).join("");
            return "<tr><td style='background:#f0f4f8;font-weight:700;font-size:11px;color:#0A1628;padding:7px 10px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap'>"+hd.slice(0,5)+"–"+hf.slice(0,5)+"</td>"+tds+"</tr>";
          }).join("");
          const w=window.open("","_blank");
          w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT "+classeEdtActuelle+"</title>"
            +"<style>body{font-family:Arial,sans-serif;padding:30px;font-size:12px}h2{color:#0A1628;text-align:center;margin-bottom:12px}"
            +"table{width:100%;border-collapse:collapse}@media print{body{padding:10px}}</style></head><body>"
            +enteteDoc(schoolInfo,schoolInfo.logo)
            +"<h2>Emploi du temps — "+classeEdtActuelle+"</h2>"
            +"<table><thead><tr><th style='background:#0A1628;color:#fff;padding:8px 10px;font-size:11px;width:80px'>Horaire</th>"+ths+"</tr></thead>"
            +"<tbody>"+rows+"</tbody></table>"
            +"<scri"+"pt>window.onload=()=>window.print();</scri"+"pt></body></html>");
          w.document.close();
        };
        const copierEDT=()=>{
          const cibles=classes.filter(c=>c.nom!==classeEdtActuelle);
          if(!cibles.length){toast("Aucune autre classe.","warning");return;}
          const dest=window.prompt("Copier l'EDT de \""+classeEdtActuelle+"\" vers quelle classe ?\n"+cibles.map(c=>c.nom).join(", "));
          if(!dest||!classes.find(c=>c.nom===dest)){toast("Classe introuvable.","error");return;}
          const aSupp=emplois.filter(e=>e.classe===dest);
          Promise.all(aSupp.map(e=>supEmp(e._id))).then(()=>{
            emploisClasse.forEach(e=>ajEmp({...e,classe:dest,_id:undefined}));
            toast("EDT copié vers "+dest,"success");
          });
        };

        // ── EDT GÉNÉRAL : Col1=Classes · Col2=Horaires (3 sous-lignes, 4 pour le 10ème) · Col3-8=Jours ──
        // Sous-lignes : 0=Matière 1=Enseignant 2=Salle (3ème slot=4ème sous-ligne vide de séparation)
        const SOUS_LABELS=["Matière","Enseignant","Salle"];
        const nbTranches=TRANCHES.length-1;
        const nbSousLignes=(ti)=>ti===9?4:3; // 10ème créneau (index 9) → 4 sous-lignes
        const totalLignesClasse=()=>{let t=0;for(let i=0;i<nbTranches;i++)t+=nbSousLignes(i);return t;};

        // ── version HTML pour impression ──
        const getEdtGeneralHTML=()=>{
          const couleursBg=["#dbeafe","#dcfce7","#fef9c3","#ffe4e6","#f3e8ff","#ffedd5","#e0f2fe","#d1fae5","#fce7f3","#ecfdf5"];
          const allMat=[...new Set(emplois.map(e=>e.matiere).filter(Boolean))];
          const mc={};allMat.forEach((m,i)=>{mc[m]=couleursBg[i%couleursBg.length];});
          const ths=JOURS.map(j=>"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;text-align:center;min-width:90px'>"+j+"</th>").join("");
          const subLabelStyle="background:#f8fafc;color:#94a3b8;font-size:9px;padding:2px 6px;text-align:right;border:1px solid #e8edf2;white-space:nowrap;font-style:italic";
          const hrStyle="background:#f0f4f8;font-weight:800;font-size:11px;color:#0A1628;padding:5px 7px;text-align:center;border:1px solid #e2e8f0;white-space:nowrap;vertical-align:middle";
          const clsStyle="background:#0A1628;color:#00C48C;font-weight:800;font-size:12px;text-align:center;padding:6px 8px;border:2px solid #0A1628;vertical-align:middle;writing-mode:horizontal-tb";
          const legendStyle="display:inline-flex;align-items:center;gap:8px;margin:0 10px 8px 0;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:700";
          const coursLegend=legendStyle+";background:#eff6ff;color:#1e3a8a;border:1px solid #bfdbfe";
          const revisionLegend=legendStyle+";background:#fff7ed;color:#9a3412;border:1px solid #fdba74";
          let tbody="";
          classesTriees.forEach(cl=>{
            const total=totalLignesClasse();
            let firstRowOfClass=true;
            for(let ti=0;ti<nbTranches;ti++){
              const hd=TRANCHES[ti],hf=TRANCHES[ti+1];
              const ns=nbSousLignes(ti);
              for(let si=0;si<ns;si++){
                const isLastSub=si===ns-1;
                const isLastSlot=ti===nbTranches-1;
                const borderB=isLastSub?(isLastSlot?"3px solid #0A1628":"2px solid #b0c4d8"):"1px solid #f0f4f8";
                let row="<tr>";
                if(firstRowOfClass&&si===0){row+="<td rowspan='"+total+"' style='"+clsStyle+"'>"+cl.nom+"</td>";firstRowOfClass=false;}
                if(si===0)row+="<td rowspan='"+ns+"' style='"+hrStyle+"'>"+hd.slice(0,5)+"<br>"+hf.slice(0,5)+"</td>";
                row+="<td style='"+subLabelStyle+";border-bottom:"+borderB+"'>"+(SOUS_LABELS[si]||"")+"</td>";
                JOURS.forEach(jour=>{
                  const cr=emplois.find(e=>e.classe===cl.nom&&e.jour===jour&&e.heureDebut===hd);
                  const isRevision=cr?.type==="revision";
                  const bg=cr?(isRevision?"#fff7ed":(mc[cr.matiere]||"#e0ebf8")):"#fff";
                  const color=isRevision?"#9a3412":"#0A1628";
                  const border=isRevision?"2px solid #fdba74":"1px solid #e2e8f0";
                  let val="";
                  if(cr){
                    if(si===0){
                      const badge=isRevision?"<div style='margin-bottom:3px'><span style=\"display:inline-block;background:#f97316;color:#fff;font-size:8px;font-weight:900;padding:2px 5px;border-radius:999px;letter-spacing:.3px\">RÉVISION</span></div>":"";
                      val=badge+"<b>"+cr.matiere+"</b>";
                    }
                    else if(si===1){
                      const ensObj=findEns(cr.enseignant);
                      val=affNom(cr.enseignant||"")+(ensObj?.telephone?"<br><span style='font-size:9px;color:#00876a;font-weight:600'>"+ensObj.telephone+"</span>":"");
                    }
                    else if(si===2)val=cr.salle||"";
                  }
                  row+="<td style='background:"+bg+";color:"+color+";border:"+border+";border-bottom:"+borderB+";padding:2px 5px;font-size:10px;text-align:center;vertical-align:middle'>"+val+"</td>";
                });
                row+="</tr>";
                tbody+=row;
              }
            }
          });
          return "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>EDT G\u00e9n\u00e9ral</title>"
            +"<style>body{font-family:Arial,sans-serif;padding:15px;font-size:11px;color:#0A1628}"
            +"h2{text-align:center;font-size:14px;margin-bottom:10px}"
            +"table{width:100%;border-collapse:collapse}"
            +"@media print{.no-print{display:none}body{padding:8px}}</style></head><body>"
            +enteteDoc(schoolInfo,schoolInfo.logo)
            +"<h2>Emploi du Temps G\u00e9n\u00e9ral</h2>"
            +"<div style='text-align:center;margin:-2px 0 12px'>"
            +"<span style='"+coursLegend+"'>Cours ordinaires</span>"
            +"<span style='"+revisionLegend+"'>Cours de révision</span>"
            +"</div>"
            +"<div class='no-print' style='text-align:center;margin-bottom:12px'>"
            +"<button onclick='window.print()' style='background:#0A1628;color:#fff;border:none;padding:7px 22px;border-radius:20px;font-size:12px;cursor:pointer;font-weight:700'>🖨️ Imprimer</button></div>"
            +"<table><thead><tr>"
            +"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:70px'>Classes</th>"
            +"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:11px;min-width:60px'>Horaires</th>"
            +"<th style='background:#0A1628;color:#fff;padding:7px 8px;font-size:10px;min-width:50px'></th>"
            +ths
            +"</tr></thead><tbody>"+tbody+"</tbody></table>"
            +"<scri"+"pt>window.onload=()=>window.print();</script></body></html>";
        };
        const voirEdtGeneral=()=>{
          const w=window.open("","_blank");
          w.document.write(getEdtGeneralHTML());
          w.document.close();
        };

        return <div>
        {/* ── TOOLBAR ── */}
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,marginRight:4}}>Emploi du temps</strong>
          <select value={classeEdtActuelle} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 12px",fontSize:13,background:"#fff",fontWeight:700,color:C.blueDark}}>
            {classesTriees.map(c=><option key={c._id} value={c.nom}>{c.nom}</option>)}
          </select>
          <Btn sm v={edtVueGrille?"blue":"ghost"} onClick={()=>setEdtVueGrille(true)}>📅 Grille</Btn>
          <Btn sm v={!edtVueGrille?"blue":"ghost"} onClick={()=>setEdtVueGrille(false)}>☰ Liste</Btn>
          {maxNote===10
            ? <select value={edtDuree} onChange={e=>setEdtDuree(Number(e.target.value))}
                title="Durée des rubriques"
                style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"5px 10px",fontSize:12,background:"#fff",color:C.blueDark}}>
                <option value={30}>Rubriques 30 min</option>
                <option value={45}>Rubriques 45 min</option>
                <option value={60}>Rubriques 1 h</option>
              </select>
            : <span style={{fontSize:11,color:"#9ca3af",padding:"4px 8px",background:"#f8fafc",borderRadius:6,border:"1px solid #e2e8f0"}}>⏱ Séances 2h</span>
          }
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.blueDark}}>
            De <input type="time" value={edtHeureDebut} onChange={e=>setEdtHeureDebut(e.target.value)}
              style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 6px",fontSize:12,width:90}}/>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:C.blueDark}}>
            à <input type="time" value={edtHeureFin} onChange={e=>setEdtHeureFin(e.target.value)}
              style={{border:"1px solid #b0c4d8",borderRadius:6,padding:"4px 6px",fontSize:12,width:90}}/>
          </label>
          {canCreate&&<Btn sm v="vert" onClick={copierEDT}>📋 Copier vers…</Btn>}
          {classeEdtActuelle!=="all"&&<Btn sm v="ghost" onClick={imprimerEDT}>🖨️ Imprimer</Btn>}
          <Btn sm v="blue" onClick={()=>setEdtGeneralOuvert(true)}>📊 EDT Général</Btn>
        </div>

        {classes.length===0
          ? <Vide icone="📅" msg="Créez d'abord des classes"/>
          : cEmp ? <Chargement/>
          : edtVueGrille ? (
          /* ── VUE GRILLE ── */
          <div style={{overflowX:"auto"}}>
            <table style={{borderCollapse:"collapse",minWidth:700,width:"100%",fontSize:12}}>
              <thead>
                <tr>
                  <th style={{background:C.blueDark,color:"#fff",padding:"8px 10px",width:72,fontSize:11}}>Horaire</th>
                  {JOURS.map(j=><th key={j} style={{background:C.blueDark,color:"#fff",padding:"8px 10px",textAlign:"center",fontSize:11,fontWeight:700}}>{j}</th>)}
                </tr>
              </thead>
              <tbody>
                {TRANCHES.slice(0,-1).map((hd,i)=>{
                  const hf=TRANCHES[i+1];
                  return <tr key={hd}>
                    <td style={{padding:"6px 8px",background:"#f0f4f8",fontWeight:700,fontSize:11,color:C.blueDark,textAlign:"center",borderBottom:"1px solid #e2e8f0",whiteSpace:"nowrap"}}>
                      {hd.slice(0,5)}–{hf.slice(0,5)}
                    </td>
                    {JOURS.map(jour=>{
                      const cr=getCreneau(jour,hd);
                      const conflit=cr&&emplois.some(x=>x._id!==cr._id&&x.enseignant&&x.enseignant===cr.enseignant&&x.jour===jour&&x.heureDebut===hd);
                      return <td key={jour}
                        onClick={()=>{
                          if(!canCreate&&!canEdit)return;
                          if(cr){setForm({...cr});setEdtCellule({jour,heureDebut:hd,heureFin:hf,existing:cr});}
                          else{setForm({classe:classeEdtActuelle,jour,heureDebut:hd,heureFin:hf,matiere:"",enseignant:"",salle:""});setEdtCellule({jour,heureDebut:hd,heureFin:hf,existing:null});}
                        }}
                        style={{
                          padding:"4px 5px",border:`1px solid ${cr?.type==="revision"?"#fdba74":"#e2e8f0"}`,
                          cursor:canCreate||canEdit?"pointer":"default",
                          background:cr?(cr.type==="revision"?"#fff7ed":matCouleur[cr.matiere]||"#e0ebf8"):"#fafcff",
                          minWidth:90,verticalAlign:"top",position:"relative",
                          transition:"filter .15s",
                        }}>
                        {cr ? <>
                          {conflit&&<span title="Conflit enseignant" style={{position:"absolute",top:2,right:3,fontSize:10}}>⚠️</span>}
                          {cr.type==="revision"&&<span style={{position:"absolute",top:2,left:3,background:"#f97316",color:"#fff",fontSize:8,fontWeight:900,padding:"1px 4px",borderRadius:3,lineHeight:1.4}}>RÉV</span>}
                          <div style={{fontWeight:800,fontSize:11,color:cr.type==="revision"?"#9a3412":"#1e3a5f",lineHeight:1.3,marginTop:cr.type==="revision"?10:0}}>{cr.matiere||"—"}</div>
                          {cr.enseignant&&(()=>{
                            const e=findEns(cr.enseignant);
                            return <div style={{fontSize:10,color:"#475569",marginTop:1}}>
                              <div>{affNom(cr.enseignant)}</div>
                              {e?.telephone&&<div style={{fontSize:9,color:"#00876a",fontWeight:600}}>{e.telephone}</div>}
                            </div>;
                          })()}
                          {cr.salle&&<div style={{fontSize:9,color:"#94a3b8",marginTop:1}}>📍{cr.salle}</div>}
                        </> : (canCreate&&<div style={{fontSize:18,color:"#c7d7e9",textAlign:"center",lineHeight:"40px"}}>+</div>)}
                      </td>;
                    })}
                  </tr>;
                })}
              </tbody>
            </table>
            <p style={{fontSize:11,color:"#9ca3af",marginTop:8}}>💡 Cliquez sur une cellule pour ajouter ou modifier un créneau</p>
          </div>
        ) : (
          /* ── VUE LISTE (groupée par jour, sans répétition) ── */
          emploisClasse.length===0
            ? <Vide icone="📅" msg="Aucun créneau pour cette classe"/>
            : <Card style={{padding:0,overflow:"hidden"}}>{(()=>{
                const lignes=[...emploisClasse].sort((a,b)=>JOURS.indexOf(a.jour)-JOURS.indexOf(b.jour)||(a.heureDebut||"").localeCompare(b.heureDebut||""));
                const rows=[];let dernierJour=null;
                lignes.forEach(e=>{
                  const jourChange=e.jour!==dernierJour;
                  dernierJour=e.jour;
                  rows.push(<TR key={e._id}>
                    {jourChange
                      ? <TD bold style={{background:"#f0f4f8",verticalAlign:"top",whiteSpace:"nowrap",borderRight:"2px solid #e2e8f0"}}>{e.jour}</TD>
                      : <td style={{background:"#f8fafc",borderRight:"2px solid #e2e8f0",borderBottom:"1px solid #f1f5f9"}}></td>}
                    <TD style={{whiteSpace:"nowrap"}}>{e.heureDebut} – {e.heureFin}</TD>
                    <TD>
                      <span style={{background:e.type==="revision"?"#fff7ed":matCouleur[e.matiere]||"#e0ebf8",
                        border:e.type==="revision"?"1px solid #fdba74":"none",
                        padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700,
                        color:e.type==="revision"?"#9a3412":"inherit"}}>
                        {e.matiere||"—"}
                      </span>
                    </TD>
                    <TD>
                      {e.type==="revision"
                        ? <span style={{background:"#fff7ed",border:"1px solid #fdba74",color:"#9a3412",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:700}}>
                            📝 Révision
                          </span>
                        : <span style={{color:"#9ca3af",fontSize:11}}>Cours</span>}
                    </TD>
                    <TD>{e.enseignant||<span style={{color:"#9ca3af",fontStyle:"italic"}}>—</span>}</TD>
                    <TD>{e.salle||"—"}</TD>
                    {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                      <Btn sm v="ghost" onClick={()=>{setForm({...e});setEdtCellule({jour:e.jour,heureDebut:e.heureDebut,heureFin:e.heureFin,existing:e});}}>Modifier</Btn>
                      <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supEmp(e._id);}}>Suppr.</Btn>
                    </div></TD>}
                  </TR>);
                });
                return <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <THead cols={["Jour","Heure","Matière","Type","Enseignant","Salle",canEdit?"":""]}/>
                  <tbody>{rows}</tbody>
                </table>;
              })()}
            </Card>
        )}

        {/* ── MINI MODAL CELLULE ── */}
        {edtCellule&&(canCreate||canEdit)&&<Modale
          titre={edtCellule.existing?"Modifier le créneau":"Nouveau créneau"}
          fermer={()=>setEdtCellule(null)}>
          <div style={{marginBottom:12,padding:"8px 12px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark,display:"flex",gap:16,flexWrap:"wrap"}}>
            <span>📅 <strong>{edtCellule.jour}</strong></span>
            <span>⏰ <strong>{edtCellule.heureDebut} → {edtCellule.heureFin}</strong></span>
            <span>🏫 <strong>{form.classe||classeEdtActuelle}</strong></span>
          </div>
          {/* Type du créneau */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[{v:"cours",label:"📚 Cours"},{v:"revision",label:"📝 Révision"}].map(t=>(
              <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))}
                style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                  background:(form.type||"cours")===t.v?(t.v==="revision"?"#fff7ed":"#eff6ff"):"#f9fafb",
                  border:`2px solid ${(form.type||"cours")===t.v?(t.v==="revision"?"#f97316":"#3b82f6"):"#e5e7eb"}`,
                  color:(form.type||"cours")===t.v?(t.v==="revision"?"#9a3412":"#1d4ed8"):"#6b7280"}}>
                {t.label}
              </button>
            ))}
          </div>

          {(form.type||"cours")==="revision"&&(
            <div style={{background:"#fff7ed",border:"1px solid #fdba74",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:20}}>📝</span>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:"#9a3412",marginBottom:4}}>Prime horaire révision</div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="number" min="0" value={form.primeRevision||""}
                    onChange={e=>setForm(p=>({...p,primeRevision:e.target.value}))}
                    placeholder="Ex : 50000"
                    style={{border:"1px solid #fdba74",borderRadius:6,padding:"6px 10px",fontSize:13,width:140,background:"#fff"}}/>
                  <span style={{fontSize:12,color:"#c2410c",fontWeight:600}}>GNF / heure</span>
                </div>
                <div style={{fontSize:11,color:"#c2410c",marginTop:4}}>Cette prime remplace la prime horaire normale pour ce créneau.</div>
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Selec label="Matière" value={form.matiere||""} onChange={e=>{setForm(p=>({...p,matiere:e.target.value,enseignant:""}));}}>
              <option value="">— Sélectionner —</option>
              {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
            </Selec>
            {(()=>{
              const ensOccupes=emplois
                .filter(x=>x.jour===edtCellule.jour&&x.heureDebut===edtCellule.heureDebut
                  &&(!edtCellule.existing||x._id!==edtCellule.existing._id)&&x.enseignant)
                .map(x=>x.enseignant);
              const ensFiltres=getEligibleTeachersForTimetable(ens,{
                classe: form.classe||classeEdtActuelle,
                matiere: form.matiere||"",
                isPrimary: isPrimarySection,
              });
              return <Selec label="Enseignant" value={form.enseignant||""} onChange={chg("enseignant")}>
                <option value="">— Sélectionner —</option>
                {ensFiltres.map(e=>{
                  const nomSimple=`${e.prenom} ${e.nom}`.trim();
                  const nomAvecMat=`${nomSimple}${e.matiere?` (${e.matiere})`:""}`; // pour compatibilité détection conflit
                  const occupe=ensOccupes.some(n=>n===nomSimple||n===nomAvecMat);
                  const label=`${nomSimple}${e.matiere?` · ${e.matiere}`:""}${e.telephone?` · ${e.telephone}`:""}`;
                  return <option key={e._id} value={nomSimple} disabled={occupe}>{occupe?`⚠️ ${label} — occupé`:label}</option>;
                })}
              </Selec>;
            })()}
            <Input label="Salle (optionnel)" value={form.salle||""} onChange={chg("salle")}/>
            <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
              <Input label="Début" type="time" value={form.heureDebut||edtCellule.heureDebut} onChange={chg("heureDebut")}/>
              <Input label="Fin" type="time" value={form.heureFin||edtCellule.heureFin} onChange={chg("heureFin")}/>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
            <div>
              {edtCellule.existing&&canEdit&&<Btn v="danger" onClick={()=>{supEmp(edtCellule.existing._id);setEdtCellule(null);}}>🗑 Supprimer</Btn>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <Btn v="ghost" onClick={()=>setEdtCellule(null)}>Annuler</Btn>
              <Btn onClick={()=>{
                if(!form.matiere){toast("Choisissez une matière.","warning");return;}
                if(!form.enseignant){toast("Choisissez un enseignant.","warning");return;}
                const typeCreneaux=form.type||"cours";
                const data={
                  classe:form.classe||classeEdtActuelle,
                  jour:edtCellule.jour,
                  heureDebut:form.heureDebut||edtCellule.heureDebut,
                  heureFin:form.heureFin||edtCellule.heureFin,
                  matiere:form.matiere,
                  enseignant:form.enseignant||"",
                  salle:form.salle||"",
                  type:typeCreneaux,
                  primeRevision:typeCreneaux==="revision"?Number(form.primeRevision||0):null,
                };
                if(edtCellule.existing)modEmp({...data,_id:edtCellule.existing._id});
                else ajEmp(data);
                setEdtCellule(null);
              }}>✅ Enregistrer</Btn>
            </div>
          </div>
        </Modale>}

        {/* ── MODAL EDT GÉNÉRAL : 8 colonnes ── */}
        {edtGeneralOuvert&&<Modale titre="📊 Emploi du Temps Général" fermer={()=>setEdtGeneralOuvert(false)}>
          <div style={{marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:12,color:"#64748b"}}>{classes.length} classe(s) · {emplois.length} créneaux</span>
            <Btn onClick={voirEdtGeneral}>🖨️ Imprimer / PDF</Btn>
          </div>
          <div style={{overflowX:"auto",maxHeight:"70dvh",overflowY:"auto"}}>
            <table style={{borderCollapse:"collapse",fontSize:11,width:"100%",minWidth:700}}>
              <thead>
                <tr style={{position:"sticky",top:0,zIndex:3}}>
                  <th style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,minWidth:65,position:"sticky",top:0}}>Classes</th>
                  <th style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,minWidth:58,position:"sticky",top:0}}>Horaires</th>
                  <th style={{background:C.blueDark,color:"#fff",padding:"6px 4px",fontSize:9,position:"sticky",top:0}}></th>
                  {JOURS.map(j=><th key={j} style={{background:C.blueDark,color:"#fff",padding:"6px 8px",fontSize:10,textAlign:"center",minWidth:85,position:"sticky",top:0}}>{j}</th>)}
                </tr>
              </thead>
              <tbody>
                {(()=>{
                  const rows=[];
                  classesTriees.forEach(cl=>{
                    const total=totalLignesClasse();
                    let first=true;
                    for(let ti=0;ti<nbTranches;ti++){
                      const hd=TRANCHES[ti],hf=TRANCHES[ti+1];
                      const ns=nbSousLignes(ti);
                      for(let si=0;si<ns;si++){
                        const isLastSub=si===ns-1;
                        const isLastSlot=ti===nbTranches-1;
                        const bBot=isLastSub?(isLastSlot?"3px solid "+C.blueDark:"2px solid #b0c4d8"):"1px solid #f0f4f8";
                        const cells=[];
                        if(first&&si===0){
                          cells.push(<td key="cls" rowSpan={total} style={{background:C.blueDark,color:C.vert,fontWeight:800,fontSize:12,textAlign:"center",padding:"6px 5px",border:"2px solid "+C.blueDark,verticalAlign:"middle"}}>{cl.nom}</td>);
                          first=false;
                        }
                        if(si===0)cells.push(<td key="hr" rowSpan={ns} style={{background:"#f0f4f8",fontWeight:800,fontSize:10,color:C.blueDark,textAlign:"center",padding:"4px 5px",border:"1px solid #e2e8f0",whiteSpace:"nowrap",verticalAlign:"middle"}}>{hd.slice(0,5)}<br/>{hf.slice(0,5)}</td>);
                        cells.push(<td key="lbl" style={{background:"#f8fafc",color:"#94a3b8",fontSize:9,padding:"2px 5px",textAlign:"right",border:"1px solid #e8edf2",borderBottom:bBot,whiteSpace:"nowrap",fontStyle:"italic"}}>{SOUS_LABELS[si]||""}</td>);
                        JOURS.forEach(jour=>{
                          const cr=emplois.find(e=>e.classe===cl.nom&&e.jour===jour&&e.heureDebut===hd);
                          const bg=cr?(matCouleur[cr.matiere]||"#e0ebf8"):"#fff";
                          let val=null;
                          if(cr){
                            if(si===0)val=<strong style={{fontSize:11}}>{cr.matiere}</strong>;
                            else if(si===1){const e=findEns(cr.enseignant);val=<span style={{fontSize:10,color:"#475569"}}>{affNom(cr.enseignant||"")}{e?.telephone&&<span style={{display:"block",fontSize:9,color:"#00876a",fontWeight:600}}>{e.telephone}</span>}</span>;}
                            else if(si===2)val=<span style={{fontSize:9,color:"#94a3b8"}}>{cr.salle||""}</span>;
                          }
                          cells.push(<td key={jour} style={{background:bg,border:"1px solid #e2e8f0",borderBottom:bBot,padding:"2px 5px",textAlign:"center",verticalAlign:"middle",minWidth:85}}>{val}</td>);
                        });
                        rows.push(<tr key={cl._id+"-"+ti+"-"+si}>{cells}</tr>);
                      }
                    }
                  });
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </Modale>}
      </div>;})()}

      {/* ── ATTESTATIONS DE NIVEAU ── */}
      {tab==="attestations"&&<div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Attestations de niveau</strong>
          <input placeholder="🔍 Recherche nom / matricule..."
            value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
          <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
            <option value="all">Toutes les classes</option>
            {classesUniq.map(c=><option key={c}>{c}</option>)}
          </select>
          <Btn sm v="amber" onClick={()=>{
            const elevesAtt=elevesFiltres.filter(e=>!rechercheMatricule
              ||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())
              ||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));
            if(!elevesAtt.length){alert("Aucun élève à imprimer.");return;}
            const w=window.open("","_blank");
            // Génération groupée en ouvrant plusieurs onglets n'est pas idéale ; on imprime la liste
            const rows=elevesAtt.map(e=>`<tr><td>${e.matricule||"—"}</td><td>${e.nom} ${e.prenom}</td><td>${e.classe}</td><td>${e.dateNaissance||"—"}</td><td>${e.lieuNaissance||"—"}</td></tr>`).join("");
            w.document.write(`<!DOCTYPE html><html><head><title>Attestations — ${filtreClasse==="all"?"Toutes classes":filtreClasse}</title><style>body{font-family:Arial,sans-serif;padding:24px}h2{color:#0A1628;text-align:center}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0A1628;color:#fff;padding:8px}td{padding:7px 8px;border-bottom:1px solid #e5e7eb}@media print{button{display:none}}</style></head><body><h2>${schoolInfo.nom||"École"} — Registre des attestations</h2><p style="text-align:center">${filtreClasse==="all"?"Toutes classes":filtreClasse} · Année ${annee}</p><table><tr><th>Matricule</th><th>Nom & Prénom</th><th>Classe</th><th>Date naissance</th><th>Lieu naissance</th></tr>${rows}</table><br/><button onclick="window.print()">🖨️ Imprimer la liste</button></body></html>`);
            w.document.close();
          }}>📋 Liste en lot</Btn>
        </div>
        <div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#166534",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>📜</span>
          <span>Cliquez sur <strong>Imprimer</strong> pour générer l'attestation officielle de niveau pour chaque élève.</span>
        </div>
        {cE?<Chargement/>:(()=>{
          const elevesAtt=elevesFiltres.filter(e=>!rechercheMatricule
            ||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())
            ||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));
          return elevesAtt.length===0?<Vide icone="📜" msg="Aucun élève pour cette sélection"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Matricule","Nom & Prénom","Classe","Niveau","Statut","Attestation"]}/>
            <tbody>{elevesAtt.map(e=><TR key={e._id}>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
              <TD bold>{e.nom} {e.prenom}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD><Badge color={avecEns?"purple":"amber"}>{avecEns?"Collège":"Primaire"}</Badge></TD>
              <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut||"Actif"}</Badge></TD>
              <TD><Btn sm v="amber" onClick={()=>imprimerAttestation(e,avecEns?"college":"primaire",annee,schoolInfo)}>🖨️ Imprimer</Btn></TD>
            </TR>)}</tbody>
          </table></Card>;
        })()}
      </div>}
    </div>
  );
}


export { Ecole };


