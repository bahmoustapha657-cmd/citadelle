import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, today } from "../constants";
import LOGO from "../assets/defaultLogo";
import { Badge, Btn, Card, Input, Modale, Selec, Stat, Textarea, Vide } from "./ui";

// ══════════════════════════════════════════════════════════════
//  CALENDRIER SCOLAIRE
// ══════════════════════════════════════════════════════════════
function Calendrier({annee}) {
  const {toast}=useContext(SchoolContext);
  const {items:evenements,ajouter:ajEv,supprimer:supEv}=useFirestore("evenements");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState({});
  const chg=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const TYPES_EV=[
    {id:"exam",      label:"Examen / Composition", color:"#ef4444"},
    {id:"conge",     label:"Congé / Vacances",      color:"#10b981"},
    {id:"reunion",   label:"Réunion",               color:"#f59e0b"},
    {id:"evenement", label:"Événement scolaire",    color:"#8b5cf6"},
    {id:"autre",     label:"Autre",                 color:"#6b7280"},
  ];

  const MOIS_LABELS=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

  const evParMois=MOIS_LABELS.map((m,i)=>({
    mois:m, num:i,
    evs:evenements.filter(e=>{
      if(!e.date) return false;
      return new Date(e.date).getMonth()===i;
    }).sort((a,b)=>a.date>b.date?1:-1)
  })).filter(m=>m.evs.length>0);

  const prochains=evenements.filter(e=>e.date&&e.date>=today()).sort((a,b)=>a.date>b.date?1:-1).slice(0,5);

  return (
    <div style={{padding:"22px 26px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18,flexWrap:"wrap"}}>
        <img src={LOGO} alt="" style={{width:48,height:48,objectFit:"contain"}}/>
        <div style={{flex:1}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,color:C.blueDark}}>Calendrier Scolaire</h2>
          <p style={{margin:0,fontSize:12,color:C.green,fontWeight:700}}>Examens, congés, réunions — {annee}</p>
        </div>
        <Btn onClick={()=>{setForm({type:"evenement",date:today()});setModal("add_ev");}}>+ Ajouter un événement</Btn>
      </div>

      {/* Légende */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
        {TYPES_EV.map(t=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:5,fontSize:12}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:t.color,flexShrink:0}}/>
            <span style={{color:"#6b7280"}}>{t.label}</span>
          </div>
        ))}
      </div>

      {/* Prochains événements */}
      {prochains.length>0&&<div style={{background:"#e0ebf8",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
        <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>📌 Prochains événements</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {prochains.map(ev=>{
            const t=TYPES_EV.find(t=>t.id===ev.type)||TYPES_EV[4];
            return <div key={ev._id} style={{background:"#fff",borderRadius:7,padding:"6px 12px",borderLeft:`3px solid ${t.color}`,fontSize:12}}>
              <span style={{fontWeight:700,color:C.blueDark}}>{ev.titre}</span>
              <span style={{color:"#9ca3af"}}> · {ev.date}</span>
              {ev.niveau&&ev.niveau!=="Tous"&&<Badge color="blue" style={{marginLeft:4}}>{ev.niveau}</Badge>}
            </div>;
          })}
        </div>
      </div>}

      {evenements.length===0?<Vide icone="📅" msg="Aucun événement — cliquez sur + Ajouter"/>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
        {evParMois.map(({mois,evs})=>(
          <Card key={mois}><div style={{padding:"12px 16px"}}>
            <p style={{margin:"0 0 10px",fontWeight:800,fontSize:14,color:C.blueDark,borderBottom:"2px solid #e0ebf8",paddingBottom:6}}>{mois}</p>
            {evs.map(ev=>{
              const t=TYPES_EV.find(t=>t.id===ev.type)||TYPES_EV[4];
              return <div key={ev._id} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:8,padding:"8px 10px",borderRadius:7,background:"#f8fafc",borderLeft:`3px solid ${t.color}`}}>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontWeight:700,fontSize:12,color:C.blueDark}}>{ev.titre}</p>
                  <p style={{margin:"2px 0 0",fontSize:11,color:"#6b7280"}}>
                    {ev.date}{ev.dateFin&&ev.dateFin!==ev.date?` → ${ev.dateFin}`:""} ·
                    <span style={{color:t.color,fontWeight:600}}> {t.label}</span>
                    {ev.niveau&&ev.niveau!=="Tous"&&<span style={{color:"#9ca3af"}}> · {ev.niveau}</span>}
                  </p>
                  {ev.description&&<p style={{margin:"3px 0 0",fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>{ev.description}</p>}
                </div>
                <Btn sm v="danger" onClick={()=>{if(confirm("Supprimer cet événement ?"))supEv(ev._id);}}>×</Btn>
              </div>;
            })}
          </div></Card>
        ))}
      </div>}

      {modal==="add_ev"&&<Modale titre="Nouvel événement" fermer={()=>setModal(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{gridColumn:"1/-1"}}><Input label="Titre de l'événement" value={form.titre||""} onChange={chg("titre")}/></div>
          <Selec label="Type" value={form.type||"evenement"} onChange={chg("type")}>
            {TYPES_EV.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </Selec>
          <Selec label="Niveau concerné" value={form.niveau||"Tous"} onChange={chg("niveau")}>
            <option>Tous</option><option>Primaire</option><option>Collège</option>
          </Selec>
          <Input label="Date début" type="date" value={form.date||""} onChange={chg("date")}/>
          <Input label="Date fin (optionnel)" type="date" value={form.dateFin||""} onChange={chg("dateFin")}/>
          <div style={{gridColumn:"1/-1"}}><Textarea label="Description (optionnel)" value={form.description||""} onChange={chg("description")}/></div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
          <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
          <Btn onClick={()=>{if(form.titre&&form.date){ajEv(form);setModal(null);}else toast("Titre et date requis","warning");}}>Enregistrer</Btn>
        </div>
      </Modale>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  HISTORIQUE DES ACTIONS
// ══════════════════════════════════════════════════════════════

export { Calendrier };
