import React from "react";
import { C, today } from "../../constants";
import { Badge, Btn, Card, Chargement, Input, Modale, Selec, TD, Textarea, THead, TR, Vide } from "../ui";

export function EnseignementsTab({
  enseignements,
  cEng,
  ajEng,
  modEng,
  supEng,
  classes,
  ens,
  matieres,
  form,
  setForm,
  modal,
  setModal,
  canCreate,
  canEdit,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
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
    </div>
  );
}
