import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, peutModifier } from "../constants";
import { Badge, Btn, Card, Chargement, Input, LectureSeule, Modale, Selec, Stat, TD, THead, TR, Tabs, Vide, UploadFichiers } from "./ui";

// ══════════════════════════════════════════════════════════════
//  MODULE FONDATION
// ══════════════════════════════════════════════════════════════
function Fondation({readOnly, userRole}) {
  const canEdit = peutModifier(userRole);
  const {schoolInfo} = useContext(SchoolContext);
  const {items:membres,chargement:cM,ajouter:ajM,modifier:modM,supprimer:supM}=useFirestore("membres");
  const {items:docs,chargement:cD,ajouter:ajD,modifier:modD,supprimer:supD}=useFirestore("documents");
  const [tab,setTab]=useState("apercu");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const sauvegarder=(aj,mod)=>{ if(modal.startsWith("add"))aj(form);else mod(form); setModal(null); };

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
        {schoolInfo?.logo&&<img src={schoolInfo.logo} alt="" style={{width:48,height:48,objectFit:"contain"}}/>}
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Fondation</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:600}}>Gouvernance & administration générale</p>
        </div>
      </div>
      {readOnly && <LectureSeule/>}
      <Tabs items={[{id:"apercu",label:"Aperçu"},{id:"membres",label:`Membres (${membres.length})`},{id:"docs",label:`Documents (${docs.length})`}]} actif={tab} onChange={setTab}/>

      {tab==="apercu"&&<div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:18}}>
          <Stat label="Membres CA" value={membres.length}/>
          <Stat label="Documents" value={docs.length}/>
          <Stat label="Établissement" value={schoolInfo?.nom||"—"} bg="#e0ebf8"/>
          <Stat label="Agrément" value={schoolInfo?.agrement||"—"} bg="#eaf4e0"/>
        </div>
        {membres.length===0&&!cM&&<Vide icone="🏛️" msg="Module vide"/>}
        {cM&&<Chargement/>}
      </div>}

      {tab==="membres"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Membres du CA ({membres.length})</strong>
          {!readOnly&&<Btn onClick={()=>{setForm({statut:"Membre"});setModal("add_m");}}>+ Ajouter</Btn>}
        </div>
        {cM?<Chargement/>:membres.length===0?<Vide icone="👥" msg="Aucun membre"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Nom & Prénom","Rôle","Statut","Téléphone","Documents",canEdit?"Actions":""]}/>
            <tbody>{membres.map(m=><TR key={m._id}>
              <TD bold>{m.prenom} {m.nom}</TD><TD>{m.role}</TD>
              <TD><Badge color={m.statut==="Fondateur"?"purple":"blue"}>{m.statut}</Badge></TD>
              <TD>{m.telephone}</TD>
              <TD>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(m.fichiers||[]).map((f,i)=>(
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,background:"#e0ebf8",padding:"2px 6px",borderRadius:4}}>📎 {f.nom}</a>
                  ))}
                </div>
              </TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...m});setModal("edit_m");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supM(m._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}

        {(modal==="add_m"||modal==="edit_m")&&!readOnly&&<Modale titre={modal==="add_m"?"Nouveau membre":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
            <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
            <Input label="Rôle" value={form.role||""} onChange={chg("role")}/>
            <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
            <Selec label="Statut" value={form.statut||"Membre"} onChange={chg("statut")}>
              <option>Fondateur</option><option>Membre</option><option>Observateur</option>
            </Selec>
          </div>
          <UploadFichiers dossier="membres" fichiers={form.fichiers||[]}
            onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
            onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>sauvegarder(ajM,modM)}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}

      {tab==="docs"&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <strong style={{fontSize:14,color:C.blueDark}}>Documents officiels ({docs.length})</strong>
          {!readOnly&&<Btn onClick={()=>{setForm({statut:"Valide"});setModal("add_d");}}>+ Ajouter</Btn>}
        </div>
        {cD?<Chargement/>:docs.length===0?<Vide icone="📄" msg="Aucun document"/>
          :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
            <THead cols={["Document","Type","Date","Statut","Fichier",canEdit?"Actions":""]}/>
            <tbody>{docs.map(d=><TR key={d._id}>
              <TD bold>{d.titre}</TD><TD><Badge color="gray">{d.type}</Badge></TD><TD>{d.date}</TD>
              <TD><Badge color={["Valide","En vigueur","Actif"].includes(d.statut)?"vert":"amber"}>{d.statut}</Badge></TD>
              <TD>{d.fichierUrl&&<a href={d.fichierUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:C.blue}}>📎 Voir</a>}</TD>
              {canEdit&&<TD><div style={{display:"flex",gap:6}}>
                <Btn sm v="ghost" onClick={()=>{setForm({...d});setModal("edit_d");}}>Modifier</Btn>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer ?"))supD(d._id);}}>Suppr.</Btn>
              </div></TD>}
            </TR>)}</tbody>
          </table></Card>}

        {(modal==="add_d"||modal==="edit_d")&&!readOnly&&<Modale titre={modal==="add_d"?"Nouveau document":"Modifier"} fermer={()=>setModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Input label="Titre" value={form.titre||""} onChange={chg("titre")}/></div>
            <Selec label="Type" value={form.type||""} onChange={chg("type")}><option>Juridique</option><option>Administratif</option><option>Pédagogique</option><option>Stratégique</option></Selec>
            <Input label="Date" type="date" value={form.date||""} onChange={chg("date")}/>
            <Selec label="Statut" value={form.statut||"Valide"} onChange={chg("statut")}><option>Valide</option><option>En vigueur</option><option>Actif</option><option>Expiré</option></Selec>
          </div>
          <UploadFichiers dossier="documents" fichiers={form.fichiers||[]}
            onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
            onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>sauvegarder(ajD,modD)}>Enregistrer</Btn>
          </div>
        </Modale>}
      </div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  TARIFS PAR CLASSE (sous-composant Comptabilite)
// ══════════════════════════════════════════════════════════════

export { Fondation };
