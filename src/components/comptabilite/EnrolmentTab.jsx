import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  C,
  CLASSES_PRIMAIRE,
  CLASSES_COLLEGE,
  CLASSES_LYCEE,
  initMens,
  genererMatricule,
  getClassesForSection,
} from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { uploadPhotoEleve } from "../../storageUtils";
import { Badge, Card, Modale, Champ, Input, Selec, Btn, THead, TR, TD, Stat, Vide, Chargement } from "../ui";
import { telechargerExcel } from "../../reports";
import { CameraCapture } from "../CameraCapture";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../enrollment-utils";

const loadXLSX = () => import("xlsx");

export function EnrolmentTab({
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
  elevesC,
  elevesL,
  elevesP,
  cEC,
  cEL,
  cEP,
  tousElevesScolarite,
  ajoutParNiveau,
  suppressionParNiveau,
  modifParNiveau,
  ensureClasse,
  sortAlpha,
}) {
  const { t } = useTranslation();
  const { schoolId, schoolInfo, toast, planInfo } = useContext(SchoolContext);

  const [niveauEnrol, setNiveauEnrol] = useState("college");
  const [afficherDeparts, setAfficherDeparts] = useState(false);
  const [cameraOuverte, setCameraOuverte] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [importEnrolPreview, setImportEnrolPreview] = useState(null);
  const [importEnrolEnCours, setImportEnrolEnCours] = useState(false);
  const [classeDefautImport, setClasseDefautImport] = useState("");
  const [ordreNomImport, setOrdreNomImport] = useState("auto");

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const handlePhotoFichier = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("Image trop grande (max 2 Mo).", "warning"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((p) => ({ ...p, photo: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const elevesParNiveau = { college: elevesC, lycee: elevesL, primaire: elevesP };
  const elevesEnrol = sortAlpha(elevesParNiveau[niveauEnrol] || []);
  const ajEnrol = ajoutParNiveau[niveauEnrol] || ajoutParNiveau.college;
  const supEnrol = suppressionParNiveau[niveauEnrol] || suppressionParNiveau.college;
  const modEnrol = modifParNiveau[niveauEnrol] || modifParNiveau.college;

  return (
    <div>
      {/* ── Alerte plan : limite atteinte ── */}
      {planInfo && !planInfo.peutAjouterEleve && (
        <div style={{background:"#fef3c7",border:"2px solid #f59e0b",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",gap:14,alignItems:"center"}}>
          <span style={{fontSize:28}}>🔒</span>
          <div style={{flex:1}}>
            <p style={{margin:"0 0 4px",fontWeight:900,fontSize:14,color:"#92400e"}}>
              Limite d'élèves atteinte — Plan {planInfo.planLabel}
            </p>
            <p style={{margin:0,fontSize:12,color:"#78350f"}}>
              Vous avez <strong>{planInfo.totalElevesActifs}</strong> élèves actifs
              sur <strong>{planInfo.eleveLimit === Infinity ? "∞" : planInfo.eleveLimit}</strong> autorisés.
              {planInfo.planCourant==="gratuit"
                ? " Contactez le Super-Admin pour activer un abonnement et inscrire plus d'élèves."
                : " Contactez le Super-Admin pour passer à un plan supérieur."}
            </p>
          </div>
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,flex:1,color:C.blueDark}}>
          {afficherDeparts?"📤 Départs & Statistiques":t("school.students.title")}
          {!afficherDeparts&&<span style={{marginLeft:10,fontSize:11,fontWeight:600,color:
            planInfo?.peutAjouterEleve?"#16a34a":"#dc2626"}}>
            ({planInfo?.totalElevesActifs ?? "…"}/{planInfo?.eleveLimit===Infinity?"∞":planInfo?.eleveLimit} élèves — Plan {planInfo?.planLabel})
          </span>}
        </strong>
        <select value={niveauEnrol} onChange={e=>setNiveauEnrol(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",color:C.blueDark,fontWeight:600}}>
          <option value="college">Collège ({elevesC.length} élèves)</option>
          <option value="lycee">Lycée ({elevesL.length} élèves)</option>
          <option value="primaire">Primaire ({elevesP.length} élèves)</option>
        </select>
        <Btn sm v={afficherDeparts?"blue":"ghost"} onClick={()=>setAfficherDeparts(d=>!d)}>
          {afficherDeparts?"👥 Élèves actifs":"📤 Départs"}
        </Btn>
        {!afficherDeparts&&canCreate&&(
          planInfo?.peutAjouterEleve
            ? <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <Btn onClick={()=>{
                  const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                  setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                  setModal("add_enrol");
                }}>+ Nouvel élève</Btn>
                <Btn v="ghost" title="Saisie rapide : formulaire minimal, enchaîner plusieurs élèves" onClick={()=>{
                  const mat=genererMatricule(elevesEnrol, niveauEnrol, schoolInfo);
                  setForm({statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"});
                  setModal("rapide_enrol");
                }}>⚡ Rapide</Btn>
                <Btn v="ghost" title="Importer depuis un fichier Excel ou CSV" onClick={()=>{setImportEnrolPreview(null);setModal("import_enrol");}}>📋 Import Excel</Btn>
              </div>
            : <Btn disabled title="Limite du plan atteinte — Contactez le Super-Admin">🔒 Limite atteinte</Btn>
        )}
      </div>
      <div style={{background:"#e0ebf8",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:C.blueDark}}>
        🔒 Seul le <strong>Comptable</strong> peut enrôler ou supprimer des élèves.
      </div>
      {!afficherDeparts&&(
        (cEC||cEL||cEP)?<Chargement/>:elevesEnrol.length===0?<Vide icone="🎓" msg="Aucun élève enregistré"/>
        :<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
            <THead cols={["Matricule","IEN","Nom & Prénom","Classe","Sexe","Filiation","Tuteur","Contact","Domicile","Statut","Actions"]}/>
            <tbody>{elevesEnrol.map(e=><TR key={e._id}>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#eef2ff",padding:"2px 5px",borderRadius:4,color:"#3730a3",fontWeight:700}}>{e.ien||"—"}</span></TD>
              <TD bold>{e.nom} {e.prenom}</TD><TD>{e.classe}</TD>
              <TD><Badge color={e.sexe==="F"?"vert":"blue"}>{e.sexe}</Badge></TD>
              <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.filiation}</span></TD>
              <TD>{e.tuteur}</TD><TD>{e.contactTuteur}</TD>
              <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.domicile}</span></TD>
              <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut}</Badge></TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...e,niveau:niveauEnrol});setModal("edit_enrol");}}>Modifier</Btn>
                {canCreate&&planInfo?.peutAjouterEleve&&<Btn sm v="ghost" title="Dupliquer — même tuteur/contact (frère/sœur)" onClick={()=>{
                  const mat=genererMatricule(elevesEnrol,niveauEnrol,schoolInfo);
                  setForm({statut:"Actif",sexe:e.sexe||"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription",
                    classe:e.classe,filiation:e.filiation,tuteur:e.tuteur,contactTuteur:e.contactTuteur,domicile:e.domicile});
                  setModal("add_enrol");
                }}>👥</Btn>}
                {e.statut==="Actif"&&<Btn sm v="amber" onClick={()=>{
                  setForm({...e,niveau:niveauEnrol,statut:"Transféré",dateDepart:new Date().toISOString().slice(0,10)});
                  setModal("edit_enrol");
                }} title="Déclarer un départ">📤</Btn>}
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer définitivement cet élève ?"))supEnrol(e._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table>
        </div>
      )}
      {afficherDeparts&&(()=>{
        const MOTIFS_DEPART = ["Transféré","Exclu","Abandonné","Décédé","Inactif"];
        const partis = elevesEnrol.filter(e=>MOTIFS_DEPART.includes(e.statut));
        const actifs = elevesEnrol.filter(e=>e.statut==="Actif");
        const total  = elevesEnrol.length;
        const tauxRetention = total>0 ? ((actifs.length/total)*100).toFixed(1) : "100";
        const parMotif = MOTIFS_DEPART.map(m=>({motif:m, count:partis.filter(e=>e.statut===m).length})).filter(x=>x.count>0);
        const parClasse = [...new Set(partis.map(e=>e.classe))].filter(Boolean).map(cl=>({
          classe:cl, count:partis.filter(e=>e.classe===cl).length
        })).sort((a,b)=>b.count-a.count);
        return (<>
          {/* ── Stats cards ── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
            <Stat label="Élèves actifs" value={actifs.length} bg="#dcfce7" sub={`${tauxRetention}% de rétention`}/>
            <Stat label="Total départs" value={partis.length} bg="#fee2e2" sub="cette année scolaire"/>
            {parMotif.map(x=>(
              <Stat key={x.motif} label={x.motif} value={x.count} bg={
                x.motif==="Transféré"?"#dbeafe":x.motif==="Exclu"?"#fef9c3":x.motif==="Abandonné"?"#ffe4e6":x.motif==="Décédé"?"#f3f4f6":"#f0fdf4"
              }/>
            ))}
          </div>
          {parClasse.length>0&&<Card style={{marginBottom:14}}>
            <div style={{padding:"12px 16px"}}>
              <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>Départs par classe</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {parClasse.map(x=>(
                  <span key={x.classe} style={{background:"#fee2e2",color:"#b91c1c",fontWeight:800,fontSize:12,padding:"4px 12px",borderRadius:20}}>
                    {x.classe} : {x.count}
                  </span>
                ))}
              </div>
            </div>
          </Card>}
          {/* ── Liste des partis ── */}
          {partis.length===0?<Vide icone="✅" msg="Aucun départ enregistré pour cette section"/>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
              <THead cols={["Matricule","Nom & Prénom","Classe","Motif","Date départ","Destination / Détail","Actions"]}/>
              <tbody>{partis.map(e=>(
                <TR key={e._id}>
                  <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                  <TD bold>{e.nom} {e.prenom}</TD>
                  <TD><Badge color="blue">{e.classe}</Badge></TD>
                  <TD><Badge color={e.statut==="Exclu"?"red":e.statut==="Décédé"?"gray":"amber"}>{e.statut}</Badge></TD>
                  <TD>{e.dateDepart||"—"}</TD>
                  <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.destinationDepart||e.motifDepart||"—"}</span></TD>
                  {canEdit&&<TD>
                    <Btn sm v="vert" onClick={async()=>{
                      if(confirm(`Réintégrer ${e.nom} ${e.prenom} comme élève Actif ?`)){
                        await modEnrol({_id:e._id,statut:"Actif",dateDepart:null,motifDepart:null,destinationDepart:null});
                        toast("Élève réintégré","success");
                      }
                    }}>↩ Réintégrer</Btn>
                  </TD>}
                </TR>
              ))}</tbody>
            </table>
          </div>}
        </>);
      })()}

      {(modal==="add_enrol"&&canCreate||(modal==="edit_enrol"&&canEdit))&&<Modale large titre={modal==="add_enrol"?"Nouvel élève":"Modifier l'élève"} fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
          <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
          <Champ label="Matricule (auto-généré)">
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input value={form.matricule||""} onChange={chg("matricule")}
                style={{flex:1,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
              <span style={{fontSize:10,color:"#9ca3af",whiteSpace:"nowrap"}}>Modifiable si besoin</span>
            </div>
          </Champ>
          <Champ label="Identifiant National (IEN)">
            <div style={{position:"relative"}}>
              <input value={form.ien||""} onChange={chg("ien")}
                placeholder="Ex : GN-2024-000123"
                style={{width:"100%",border:"1.5px solid #c7d2fe",borderRadius:8,padding:"7px 10px 7px 30px",fontSize:13,boxSizing:"border-box",outline:"none",background:"#eef2ff",fontFamily:"monospace",fontWeight:700,color:"#3730a3"}}/>
              <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🪪</span>
            </div>
          </Champ>
          <Champ label="Classe">
            <select value={form.classe||""} onChange={chg("classe")}
              style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
              <option value="">— Sélectionner —</option>
              {getClassesForSection(niveauEnrol).map(c=><option key={c}>{c}</option>)}
            </select>
          </Champ>
          <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
            <option value="M">Masculin</option><option value="F">Féminin</option>
          </Selec>
          <Selec label="Statut" value={form.statut||"Actif"} onChange={chg("statut")}>
            <option>Actif</option><option>Inactif</option><option>Transféré</option><option>Exclu</option><option>Abandonné</option><option>Décédé</option>
          </Selec>
          <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
            <option>Première inscription</option><option>Réinscription</option>
          </Selec>
          {["Transféré","Exclu","Abandonné","Décédé"].includes(form.statut)&&<>
            <Input label="Date de départ" type="date" value={form.dateDepart||""} onChange={chg("dateDepart")}/>
            <div style={{gridColumn:"1/-1"}}>
              <Input label="Motif du départ" value={form.motifDepart||""} onChange={chg("motifDepart")} placeholder="Ex: Transfert vers Lycée Donka, fin d'année..."/>
            </div>
            {form.statut==="Transféré"&&<div style={{gridColumn:"1/-1"}}>
              <Input label="École de destination" value={form.destinationDepart||""} onChange={chg("destinationDepart")} placeholder="Nom de l'école d'accueil"/>
            </div>}
          </>}
          <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")}/></div>
          <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")}/>
          <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")}/>
          <Input label="Domicile Tuteur" value={form.domicile||""} onChange={chg("domicile")}/>
          <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
          <Input label="Lieu de naissance" value={form.lieuNaissance||""} onChange={chg("lieuNaissance")}/>
          {form.typeInscription==="Réinscription"&&
            <Input label="Établissement d'origine (si transféré)" value={form.etablissementOrigine||""} onChange={chg("etablissementOrigine")} placeholder="Nom de l'ancienne école"/>
          }
        </div>
        {/* Photo de l'élève */}
        <div style={{marginTop:14,borderTop:"1px solid #e5e7eb",paddingTop:14}}>
          <p style={{fontSize:10,fontWeight:700,color:C.blue,textTransform:"uppercase",margin:"0 0 10px",letterSpacing:"0.07em"}}>📷 Photo de l'élève (optionnel)</p>
          <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",border:`2px solid ${C.blue}`,background:"#f0f4f8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {form.photo
                ? <img src={form.photo} alt="photo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <span style={{fontSize:32}}>👤</span>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <Btn v="blue" onClick={()=>setCameraOuverte(true)}>📸 Prendre une photo</Btn>
              <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.blue}`,background:"#fff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                📁 Importer depuis la galerie
                <input type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoFichier}/>
              </label>
              {form.photo&&<Btn sm v="danger" onClick={()=>setForm(p=>({...p,photo:""}))}>✕ Supprimer</Btn>}
            </div>
          </div>
        </div>
        {cameraOuverte&&<CameraCapture onCapture={photo=>{setForm(p=>({...p,photo}));setCameraOuverte(false);}} onClose={()=>setCameraOuverte(false)}/>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)} disabled={uploadEnCours}>Annuler</Btn>
          <Btn disabled={uploadEnCours} onClick={async()=>{
            setUploadEnCours(true);
            try{
              let photoUrl = form.photo || "";
              if(photoUrl.startsWith("data:")){
                photoUrl = await uploadPhotoEleve(photoUrl, schoolId);
              }
              const r={...form, photo:photoUrl, mens:form.mens||initMens()};
              const doublon = findEnrollmentDuplicate(r, tousElevesScolarite, {
                excludeId: modal==="edit_enrol" ? r._id : null,
              });
              if(doublon){
                toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
                return;
              }
              if(modal==="add_enrol") {
                await ajEnrol(r);
                await ensureClasse(r.classe, niveauEnrol);
              } else {
                await modEnrol(r);
              }
              setModal(null);
            }catch(e){
              toast("Erreur upload photo : "+e.message,"error");
            }finally{
              setUploadEnCours(false);
            }
          }}>{uploadEnCours?"⏳ Upload photo...":"Enregistrer"}</Btn>
        </div>
      </Modale>}

      {/* ── SAISIE RAPIDE (fratrie / même tuteur) ── */}
      {modal==="rapide_enrol"&&canCreate&&<Modale titre="⚡ Saisie rapide — Fratrie / même tuteur" fermer={()=>setModal(null)}>
        <div style={{background:"#f0f6ff",border:`1.5px solid ${C.blue}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>
            👨‍👩‍👧‍👦 Informations communes (conservées pour chaque élève)
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")} placeholder="Bah Mamadou"/>
            <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")} placeholder="622 000 000"/>
            <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")} placeholder="Père: … / Mère: …"/></div>
            <div style={{gridColumn:"1/-1"}}><Input label="Domicile" value={form.domicile||""} onChange={chg("domicile")} placeholder="Quartier, commune…"/></div>
          </div>
        </div>
        <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px"}}>
          <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>
            🎓 Élève à inscrire
          </p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Nom *" value={form.nom||""} onChange={chg("nom")} placeholder="Bah"/>
            <Input label="Prénom *" value={form.prenom||""} onChange={chg("prenom")} placeholder="Aminata"/>
            <Champ label="Classe *">
              <select value={form.classe||""} onChange={chg("classe")}
                style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
                <option value="">— Sélectionner —</option>
            {getClassesForSection(niveauEnrol).map(c=><option key={c}>{c}</option>)}
              </select>
            </Champ>
            <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
              <option value="M">Masculin</option><option value="F">Féminin</option>
            </Selec>
            <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
            <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
              <option>Première inscription</option><option>Réinscription</option>
            </Selec>
            <Champ label="Matricule (auto)">
              <input value={form.matricule||""} onChange={chg("matricule")}
                style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
            </Champ>
          </div>
        </div>
        {(()=>{
          const sauvegarderRapide = async (fermer) => {
            if(!form.nom||!form.prenom){toast("Nom et prénom obligatoires","warning");return false;}
            if(!form.classe){toast("Classe obligatoire","warning");return false;}
            const r={...form,statut:"Actif",mens:initMens()};
            const doublon = findEnrollmentDuplicate(r, tousElevesScolarite);
            if(doublon){
              toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
              return false;
            }
            await ajEnrol(r);
            await ensureClasse(r.classe, niveauEnrol);
            toast(`${r.prenom} ${r.nom} ajoute(e)`,"success");
            if(!fermer){
              const mat=genererMatricule([...elevesEnrol,r],niveauEnrol,schoolInfo);
              setForm(p=>({tuteur:p.tuteur,contactTuteur:p.contactTuteur,filiation:p.filiation,domicile:p.domicile,
                statut:"Actif",sexe:"M",niveau:niveauEnrol,matricule:mat,typeInscription:"Première inscription"}));
            }
            return true;
          };
          return (
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
              <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
              <Btn v="ghost" onClick={async()=>{ await sauvegarderRapide(false); }}>➕ Élève suivant</Btn>
              <Btn onClick={async()=>{ if(await sauvegarderRapide(true)) setModal(null); }}>✅ Terminer</Btn>
            </div>
          );
        })()}
      </Modale>}

      {/* ── IMPORT EXCEL (adaptatif) ── */}
      {modal==="import_enrol"&&canCreate&&<Modale titre="📋 Importer des élèves depuis Excel" fermer={()=>{setModal(null);setImportEnrolPreview(null);}} large>
        <div style={{marginBottom:12,padding:"10px 14px",background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,fontSize:12,color:"#0369a1"}}>
          <strong>📌 Détection automatique des colonnes</strong> — Peu importe l'ordre ou le nom exact des colonnes dans votre fichier, le système les reconnaît automatiquement.<br/>
          Seuls <strong>Nom</strong>, <strong>Prénom</strong> et <strong>Classe</strong> sont obligatoires. Tous les autres champs sont optionnels.
        </div>
        <div style={{display:"flex",gap:10,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
          <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:8,border:`1.5px dashed ${C.blue}`,background:"#f0f6ff",color:C.blue,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            📂 Choisir un fichier Excel / CSV
            <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={async e=>{
              const file=e.target.files[0]; if(!file) return;
              const ab=await file.arrayBuffer();
              const XLSX = await loadXLSX();
              const wb=XLSX.read(ab,{cellDates:true});
              const ws=wb.Sheets[wb.SheetNames[0]];
              const allRows=XLSX.utils.sheet_to_json(ws,{header:1,defval:"",raw:false});
              if(allRows.length<2){toast("Fichier vide ou sans données","warning");return;}

              const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g," ").trim();

              const HDR_KW=["nom","prenom","eleve","classe","sexe","date","lieu","pere","mere","telephone","matricule","naissance","contact","n°","numero"];
              const scoreHdr=row=>row.reduce((s,c)=>{
                const hn=norm(String(c||""));
                return s+(HDR_KW.some(k=>hn===k||hn.startsWith(k+' ')||hn.endsWith(' '+k)||(' '+hn+' ').includes(' '+k+' '))?1:0);
              },0);
              let headerRowIdx=0, bestScore=scoreHdr(allRows[0]);
              for(let ri=1;ri<Math.min(5,allRows.length-1);ri++){
                const sc=scoreHdr(allRows[ri]);
                if(sc>bestScore){bestScore=sc;headerRowIdx=ri;}
              }

              const headers=allRows[headerRowIdx].map(h=>String(h||""));

              const wordMatch=(hn,v)=>{
                if(hn===v) return true;
                const hnW=hn.split(/\s+/), vW=v.split(/\s+/);
                return vW.every(vw=>hnW.some(hw=>{
                  if(hw===vw) return true;
                  if(hw.length>=3&&vw.length>=3&&(hw.startsWith(vw)||vw.startsWith(hw))) return true;
                  return false;
                }));
              };
              const findCol=(variants)=>{
                for(const v of variants){
                  const idx=headers.findIndex(h=>{
                    const hn=norm(h);
                    return hn&&wordMatch(hn,v);
                  });
                  if(idx>=0) return idx;
                }
                return -1;
              };
              const cols={
                num:       findCol(["n","no","num","numero"]),
                matricule: findCol(["matricule","mat","numero eleve","id eleve"]),
                eleveComplet: findCol(["eleve","noms et prenoms","nom et prenom","nom complet","prenom et nom","nomcomplet","nom prenom","full name"]),
                nom:       findCol(["nom eleve","nom de l eleve","nom famille","last name","surname","noms","nom"]),
                prenom:    findCol(["prenom eleve","prenom de l eleve","prenoms","first name","given name","forename","prenom"]),
                classe:    findCol(["classe","class","niveau","section","group"]),
                sexe:      findCol(["sexe","genre","sex","gender","masculin","feminin"]),
                date:      findCol(["date naissance","date de naissance","date naiss","ne le","dob","birth"]),
                lieuNaiss: findCol(["lieu naissance","lieu de naissance","lieu naiss","ville naissance","birthplace","born in","ne a"]),
                pere:      findCol(["pere","father","papa","nom pere"]),
                mere:      findCol(["mere","mother","maman","nom mere"]),
                filiation: findCol(["pere et mere","filiation","parents","famille"]),
                tuteur:    findCol(["tuteur","responsable","gardien","tuteur legal"]),
                contact:   findCol(["telephone","tel","phone","mobile","gsm","numero telephone","contact"]),
                domicile:  findCol(["domicile","adresse","quartier","residence","localite"]),
                typeInsc:  findCol(["type inscription","type inscript","reinscription","premiere inscription"]),
                ien:       findCol(["ien","identifiant national","id national","matricule national","identifiant"]),
              };
              if(cols.nom>=0&&cols.nom===cols.prenom){
                if(cols.eleveComplet<0) cols.eleveComplet=cols.nom;
                cols.nom=-1; cols.prenom=-1;
              }

              const parseDate=val=>{
                if(!val) return "";
                const s=String(val).trim();
                if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
                const m1=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
                if(m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
                const m2=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                if(m2) return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
                return s;
              };

              const get=(row,idx)=>idx>=0?String(row[idx]||"").trim():"";
              const classesConnues=[...CLASSES_COLLEGE,...CLASSES_PRIMAIRE,...CLASSES_LYCEE].map(c=>c.toLowerCase());
              const classesEcole=[...new Set(tousElevesScolarite.map(e=>e.classe||"").filter(Boolean))].map(c=>c.toLowerCase());

              const rows=allRows.slice(headerRowIdx+1).filter(r=>r.some(c=>String(c||"").trim()));
              const lignes=[];
              const candidatsImport=[];
              for(const [i, r] of rows.entries()){
                let nom=get(r,cols.nom);
                let prenom=get(r,cols.prenom);
                if((!nom||!prenom) && cols.eleveComplet>=0){
                  const complet=get(r,cols.eleveComplet);
                  if(complet){
                    const parts=complet.trim().split(/\s+/);
                    const premier=parts[0]||"";
                    const premierEstMaj=premier.length>1&&premier===premier.toUpperCase()&&/[A-Z]/.test(premier);
                    const nomEnPremier = ordreNomImport==="nom_prenom"
                      || (ordreNomImport==="auto" && premierEstMaj);
                    if(nomEnPremier){
                      if(!nom) nom=parts[0]||"";
                      if(!prenom) prenom=parts.slice(1).join(" ")||"";
                    } else {
                      if(!nom) nom=parts[parts.length-1]||"";
                      if(!prenom) prenom=parts.slice(0,-1).join(" ")||"";
                    }
                  }
                }
                const classe=get(r,cols.classe)||classeDefautImport;
                const sexeRaw=get(r,cols.sexe).toUpperCase();
                const sexe=sexeRaw==="F"||sexeRaw.startsWith("F")?"F":"M";
                const dateNaissance=parseDate(get(r,cols.date));
                const lieuNaissance=get(r,cols.lieuNaiss);
                const pereVal=get(r,cols.pere);
                const mereVal=get(r,cols.mere);
                const filiation=pereVal||mereVal
                  ? [pereVal?"Pere: "+pereVal:"", mereVal?"Mere: "+mereVal:""] .filter(Boolean).join(" / ")
                  : get(r,cols.filiation);
                const tuteur=get(r,cols.tuteur)||pereVal||mereVal;
                const contactTuteur=get(r,cols.contact);
                const domicile=get(r,cols.domicile);
                const ti=get(r,cols.typeInsc);
                const typeInscription=ti||"Premiere inscription";
                const matriculeFichier=get(r,cols.matricule);
                const ien=get(r,cols.ien)||(cols.ien<0?matriculeFichier:"");
                const ligneCandidate={nom,prenom,classe,sexe,dateNaissance,lieuNaissance,ien,tuteur,contactTuteur,filiation,domicile,typeInscription};
                const erreurs=[];
                const avertissements=[];
                if(!nom) erreurs.push("Nom manquant");
                if(!prenom) erreurs.push("Prenom manquant");
                if(!classe) avertissements.push("Classe non definie - selectionner une classe par defaut");
                else if(!classesEcole.includes(classe.toLowerCase())&&!classesConnues.includes(classe.toLowerCase())){
                  avertissements.push(`Classe "${classe}" non reconnue`);
                }
                if(!erreurs.length){
                  const doublonExistant = findEnrollmentDuplicate(ligneCandidate, tousElevesScolarite);
                  if(doublonExistant){
                    erreurs.push(getEnrollmentDuplicateMessage(doublonExistant, ligneCandidate, { scope: "deja dans l'ecole" }));
                  } else {
                    const doublonImport = findEnrollmentDuplicate(ligneCandidate, candidatsImport);
                    if(doublonImport){
                      erreurs.push(getEnrollmentDuplicateMessage(doublonImport, ligneCandidate, { scope: "deja dans ce fichier" }));
                    } else {
                      candidatsImport.push(ligneCandidate);
                    }
                  }
                }
                lignes.push({
                  ...ligneCandidate,
                  erreurs,
                  avertissements,
                  ligne:i+2,
                });
              }

              const champLabels={num:"N°(ignoré)",matricule:"Matricule→IEN",eleveComplet:"Élève",nom:"Nom",prenom:"Prénom",classe:"Classe",sexe:"Sexe",date:"Date naissance",lieuNaiss:"Lieu naissance",pere:"Père",mere:"Mère",filiation:"Père et Mère (combiné)",tuteur:"Tuteur",contact:"Téléphone",domicile:"Domicile",typeInsc:"Type inscription",ien:"IEN"};
              const mapping=Object.entries(cols).map(([k,idx])=>({champ:champLabels[k],colonne:idx>=0?headers[idx]:null,idx}));

              setImportEnrolPreview({lignes,valides:lignes.filter(l=>!l.erreurs.length),mapping,nbAvert:lignes.filter(l=>!l.erreurs.length&&l.avertissements?.length).length});
              e.target.value="";
            }}/>
          </label>
          <Btn v="ghost" onClick={async()=>{
            const XLSX = await loadXLSX();
            const wb=XLSX.utils.book_new();
            const ws=XLSX.utils.aoa_to_sheet([
              [t("reports.excel.template.n"),t("reports.excel.template.matricule"),t("reports.excel.template.student"),t("reports.excel.template.sex"),t("reports.excel.template.dateOfBirth"),t("reports.excel.template.birthPlace"),t("reports.excel.template.father"),t("reports.excel.template.mother"),t("reports.excel.template.phone")],
              [1,"","BAH Aminata","F","2012-03-15","Conakry","Mamadou Bah","Fatoumata Diallo","622000001"],
              [2,"","DIALLO Ibrahima Sékou","M","2013-07-22","Kindia","Boubacar Diallo","Mariama Bah","628000002"],
            ]);
            XLSX.utils.book_append_sheet(wb,ws,t("reports.excel.template.sheetStudents"));
            await telechargerExcel(wb,t("reports.excel.template.filename"));
          }}>⬇️ {t("common.template")} Excel</Btn>
        </div>

        <div style={{marginBottom:8,padding:"10px 14px",background:"#fefce8",border:"1px solid #fde047",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>📚 Classe à affecter</span>
          <span style={{fontSize:12,color:"#713f12",flex:1}}>Si votre fichier n'a pas de colonne Classe, sélectionnez-en une ici.</span>
          <select value={classeDefautImport} onChange={e=>setClasseDefautImport(e.target.value)}
            style={{border:"1.5px solid #fbbf24",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff",fontWeight:700,color:"#0A1628"}}>
            <option value="">— Classe du fichier —</option>
            {getClassesForSection(niveauEnrol).map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{marginBottom:12,padding:"10px 14px",background:"#f5f3ff",border:"1px solid #c4b5fd",borderRadius:10,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:700,color:"#5b21b6"}}>🔤 Ordre du nom complet</span>
          <span style={{fontSize:12,color:"#6d28d9",flex:1}}>Quand le nom et le prénom sont dans une seule colonne, dans quel ordre ?</span>
          {[
            {val:"nom_prenom", label:"NOM Prénom",  ex:"DIALLO Mamadou"},
            {val:"prenom_nom", label:"Prénom NOM",  ex:"Mamadou DIALLO"},
            {val:"auto",       label:"Auto-detect", ex:"Majuscules = NOM"},
          ].map(({val,label,ex})=>(
            <label key={val} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,fontWeight:ordreNomImport===val?700:400}}>
              <input type="radio" name="ordreNom" value={val} checked={ordreNomImport===val} onChange={()=>setOrdreNomImport(val)}/>
              <span>{label}</span>
              <span style={{color:"#7c3aed",fontSize:11,fontStyle:"italic"}}>({ex})</span>
            </label>
          ))}
        </div>

        {importEnrolPreview&&<>
          <div style={{marginBottom:12,border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden"}}>
            <div style={{background:"#f8fafc",padding:"8px 14px",fontSize:11,fontWeight:800,color:"#475569",borderBottom:"1px solid #e2e8f0"}}>
              🗺️ Colonnes détectées dans votre fichier
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"10px 14px"}}>
              {importEnrolPreview.mapping.map(({champ,colonne})=>(
                <span key={champ} style={{
                  padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                  background:colonne?"#dcfce7":"#fef9c3",
                  color:colonne?"#15803d":"#92400e",
                  border:`1px solid ${colonne?"#86efac":"#fde68a"}`
                }}>
                  {champ} {colonne?`→ "${colonne}"` :"— non trouvé"}
                </span>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:14,marginBottom:10,fontSize:12,flexWrap:"wrap"}}>
            <span style={{color:"#059669",fontWeight:700}}>✅ {importEnrolPreview.valides.length} prêts à importer</span>
            {importEnrolPreview.nbAvert>0&&<span style={{color:"#d97706",fontWeight:700}}>⚠️ {importEnrolPreview.nbAvert} avec avertissement</span>}
            <span style={{color:"#dc2626",fontWeight:700}}>❌ {importEnrolPreview.lignes.length-importEnrolPreview.valides.length} bloqués (champs obligatoires manquants)</span>
          </div>
          <div style={{maxHeight:260,overflowY:"auto",border:"1px solid #e2e8f0",borderRadius:8,marginBottom:12}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{background:"#f8fafc",position:"sticky",top:0}}>
                {["L.","Nom","Prénom","Classe","Sexe","Date naiss.","Tuteur","Statut"].map(h=>(
                  <th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:"#64748b"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{importEnrolPreview.lignes.map((l,i)=>(
                <tr key={i} style={{background:l.erreurs.length?"#fef2f2":l.avertissements?.length?"#fffbeb":"#f0fdf4",borderBottom:"1px solid #f1f5f9"}}>
                  <td style={{padding:"4px 8px",color:"#94a3b8",fontSize:10}}>{l.ligne}</td>
                  <td style={{padding:"4px 8px",fontWeight:600}}>{l.nom||"—"}</td>
                  <td style={{padding:"4px 8px"}}>{l.prenom||"—"}</td>
                  <td style={{padding:"4px 8px"}}>{l.classe||"—"}</td>
                  <td style={{padding:"4px 8px"}}>{l.sexe}</td>
                  <td style={{padding:"4px 8px"}}>{l.dateNaissance||"—"}</td>
                  <td style={{padding:"4px 8px"}}>{l.tuteur||"—"}</td>
                  <td style={{padding:"4px 8px"}}>
                    {l.erreurs.length
                      ?<span style={{color:"#dc2626",fontSize:10}}>❌ {l.erreurs.join(", ")}</span>
                      :l.avertissements?.length
                        ?<span style={{color:"#d97706",fontSize:10}}>⚠️ {l.avertissements.join(", ")}</span>
                        :<span style={{color:"#059669",fontSize:10}}>✅</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>}

        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
          <Btn v="ghost" onClick={()=>{setModal(null);setImportEnrolPreview(null);}}>Annuler</Btn>
          {importEnrolPreview?.valides.length>0&&<Btn v="vert" disabled={importEnrolEnCours} onClick={async()=>{
            setImportEnrolEnCours(true);
            let count=0;
            const existants=tousElevesScolarite;
            const matsGeneres=[];
            const classesImportCreees=new Set();
            const ajFn=ajoutParNiveau[niveauEnrol] || ajoutParNiveau.college;
            const lotImporte=[];
            for(const l of importEnrolPreview.valides){
              const doublon = findEnrollmentDuplicate(l, [...existants, ...lotImporte]);
              if(doublon) continue;
              const mat=genererMatricule([...elevesEnrol,...matsGeneres],niveauEnrol,schoolInfo);
              const eleveAImporter={
                nom:l.nom,prenom:l.prenom,classe:l.classe,sexe:l.sexe,
                dateNaissance:l.dateNaissance,lieuNaissance:l.lieuNaissance,ien:l.ien,
                tuteur:l.tuteur,contactTuteur:l.contactTuteur,
                filiation:l.filiation,domicile:l.domicile,
                typeInscription:l.typeInscription,
                matricule:mat,statut:"Actif",mens:initMens(),
              };
              matsGeneres.push({matricule:mat});
              await ajFn(eleveAImporter);
              lotImporte.push(eleveAImporter);
              await ensureClasse(l.classe, niveauEnrol, classesImportCreees);
              count++;
            }
            setImportEnrolEnCours(false);
            setModal(null);
            setImportEnrolPreview(null);
            toast(`${count} élève(s) importé(s) avec succès`,"success");
          }}>
            {importEnrolEnCours?`⏳ Import en cours…`:`⬆️ Importer ${importEnrolPreview.valides.length} élève(s)`}
          </Btn>}
        </div>
      </Modale>}
    </div>
  );
}
