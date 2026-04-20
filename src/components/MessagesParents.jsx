import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C } from "../constants";
import { Btn, Card, Champ, Input, Modale, Selec, Stat, Vide } from "./ui";

const creerTimestamp = () => Date.now();

function MessagesParents({readOnly}) {
  const {schoolInfo,toast,envoyerPush} = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1||C.blue;
  const {items:msgs, modifier:modMsg, ajouter:repMsg} = useFirestore("messages");
  const {items:annonces, ajouter:ajAnn, supprimer:supAnn} = useFirestore("annonces");
  const [tab,setTab]       = useState("messages");
  const [selMsg,setSelMsg] = useState(null);
  const [reponse,setRep]   = useState("");
  const [formAnn,setFormAnn]= useState({titre:"",corps:"",important:false});
  const [modal,setModal]   = useState(null);

  const threads = Object.values(
    msgs.reduce((acc,m)=>{
      const key = m.eleveId||m.eleveNom||m.expediteurLogin;
      if(!acc[key]) acc[key]={key,eleveNom:m.eleveNom,expediteurLogin:m.expediteurLogin,messages:[],nonLus:0};
      acc[key].messages.push(m);
      if(m.expediteur==="parent"&&!m.lu) acc[key].nonLus++;
      return acc;
    },{})
  ).sort((a,b)=>Math.max(...b.messages.map(m=>m.date))-Math.max(...a.messages.map(m=>m.date)));

  const threadSelec = selMsg ? threads.find(t=>t.key===selMsg) : null;

  const marquerLus = async(thread) => {
    for(const m of thread.messages){
      if(m.expediteur==="parent"&&!m.lu) await modMsg({...m,lu:true});
    }
  };

  const envoyerReponse = async() => {
    if(!reponse.trim()||!threadSelec) return;
    await repMsg({
      expediteur:"ecole",
      expediteurNom:"École",
      eleveId:threadSelec.messages[0]?.eleveId,
      eleveNom:threadSelec.eleveNom,
      destinataireLogin:threadSelec.expediteurLogin,
      sujet:"Réponse : "+(threadSelec.messages[0]?.sujet||""),
      corps:reponse.trim(),
      lu:false,
      date:creerTimestamp(),
    });
    // Notifier le parent par push
    envoyerPush(
      ["parent"],
      `📩 Message de ${schoolInfo.nom||"l'école"}`,
      `Concernant ${threadSelec.eleveNom} : ${reponse.trim().slice(0,80)}${reponse.length>80?"…":""}`,
      "/messages"
    );
    setRep("");
  };

  return (
    <div style={{padding:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:900,color:c1}}>💬 Liaison École–Famille</h2>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:20,background:"#f1f5f9",borderRadius:10,padding:4,width:"fit-content"}}>
        {[{id:"messages",label:`Messages (${threads.reduce((s,t)=>s+t.nonLus,0)||""})`},{id:"annonces",label:"Annonces"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 18px",border:"none",borderRadius:8,cursor:"pointer",
            fontSize:13,fontWeight:700,
            background:tab===t.id?"#fff":"transparent",
            color:tab===t.id?c1:"#64748b",
            boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Messages ── */}
      {tab==="messages"&&<div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16,minHeight:400}}>
        {/* Liste threads */}
        <Card style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
            <strong style={{fontSize:12,color:"#64748b"}}>Conversations ({threads.length})</strong>
          </div>
          {threads.length===0&&<div style={{padding:20,textAlign:"center",color:"#94a3b8",fontSize:13}}>Aucun message</div>}
          {threads.map(t=>(
            <div key={t.key} onClick={()=>{setSelMsg(t.key);marquerLus(t);}}
              style={{padding:"12px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer",
                background:selMsg===t.key?`${c1}0d`:"#fff",
                borderLeft:selMsg===t.key?`3px solid ${c1}`:"3px solid transparent"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <div style={{width:32,height:32,borderRadius:8,background:c1,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:12,flexShrink:0}}>
                  {(t.eleveNom||"?")[0]}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:12,color:"#0A1628",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.eleveNom||t.expediteurLogin}</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{t.messages.length} message(s)</div>
                </div>
                {t.nonLus>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,flexShrink:0}}>{t.nonLus}</span>}
              </div>
            </div>
          ))}
        </Card>

        {/* Détail conversation */}
        <Card style={{padding:0,display:"flex",flexDirection:"column"}}>
          {!threadSelec&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#94a3b8",fontSize:13}}>← Sélectionner une conversation</div>}
          {threadSelec&&<>
            <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
              <strong style={{fontSize:13,color:c1}}>{threadSelec.eleveNom}</strong>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:10}}>
              {threadSelec.messages.sort((a,b)=>a.date-b.date).map((m,i)=>{
                const estEcole = m.expediteur==="ecole";
                return (
                  <div key={i} style={{display:"flex",flexDirection:"column",alignItems:estEcole?"flex-end":"flex-start"}}>
                    <div style={{
                      maxWidth:"80%",background:estEcole?`${c1}15`:"#fff",
                      border:`1px solid ${estEcole?c1+"33":"#e2e8f0"}`,
                      borderRadius:estEcole?"16px 16px 4px 16px":"16px 16px 16px 4px",
                      padding:"10px 14px",
                    }}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:4}}>{estEcole?"École":m.expediteurNom} · {new Date(m.date).toLocaleDateString("fr-FR")}</div>
                      <div style={{fontSize:12,fontWeight:700,color:"#0A1628",marginBottom:4}}>{m.sujet}</div>
                      <div style={{fontSize:13,color:"#475569",lineHeight:1.6}}>{m.corps}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!readOnly&&<div style={{padding:"12px 18px",borderTop:"1px solid #f1f5f9",display:"flex",gap:8}}>
              <textarea value={reponse} onChange={e=>setRep(e.target.value)}
                rows={2} placeholder="Répondre..."
                style={{flex:1,border:"1.5px solid #e2e8f0",borderRadius:8,padding:"8px 12px",fontSize:13,resize:"none",outline:"none",fontFamily:"inherit"}}/>
              <Btn onClick={envoyerReponse} disabled={!reponse.trim()}>Envoyer</Btn>
            </div>}
          </>}
        </Card>
      </div>}

      {/* ── Annonces ── */}
      {tab==="annonces"&&<>
        {!readOnly&&<div style={{marginBottom:16,display:"flex",justifyContent:"flex-end"}}>
          <Btn onClick={()=>setModal("add_ann")}>+ Nouvelle annonce</Btn>
        </div>}
        {annonces.length===0&&<Vide icone="📌" msg="Aucune annonce publiée"/>}
        {annonces.sort((a,b)=>b.date-a.date).map((an,i)=>(
          <Card key={i} style={{marginBottom:10,borderLeft:`4px solid ${an.important?"#f59e0b":c1}`}}>
            <div style={{padding:"14px 18px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                {an.important&&<span style={{background:"#fef3c7",color:"#d97706",fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:8}}>📌 Important</span>}
                <strong style={{fontSize:14,color:"#0A1628"}}>{an.titre}</strong>
                <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{an.auteur} · {new Date(an.date).toLocaleDateString("fr-FR")}</span>
                {!readOnly&&<Btn sm v="danger" onClick={()=>supAnn(an._id)}>🗑</Btn>}
              </div>
              <p style={{margin:0,fontSize:13,color:"#475569",lineHeight:1.7}}>{an.corps}</p>
            </div>
          </Card>
        ))}

        {modal==="add_ann"&&<Modale titre="Nouvelle annonce" fermer={()=>setModal(null)}>
          <Input label="Titre" value={formAnn.titre} onChange={e=>setFormAnn(p=>({...p,titre:e.target.value}))} placeholder="Ex: Réunion parents - vendredi 18h"/>
          <div style={{height:10}}/>
          <Champ label="Contenu">
            <textarea value={formAnn.corps} onChange={e=>setFormAnn(p=>({...p,corps:e.target.value}))}
              rows={4} placeholder="Détails de l'annonce..."
              style={{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:8,padding:"10px 12px",fontSize:13,resize:"vertical",outline:"none",fontFamily:"inherit"}}/>
          </Champ>
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" id="imp" checked={formAnn.important} onChange={e=>setFormAnn(p=>({...p,important:e.target.checked}))}/>
            <label htmlFor="imp" style={{fontSize:13,color:"#374151",cursor:"pointer"}}>Marquer comme importante 📌</label>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
            <Btn onClick={()=>{
              if(!formAnn.titre.trim()||!formAnn.corps.trim()){toast("Titre et contenu requis.","warning");return;}
              ajAnn({...formAnn,auteur:schoolInfo.nom||"École",date:Date.now()});
              setFormAnn({titre:"",corps:"",important:false});
              setModal(null);
            }}>Publier</Btn>
          </div>
        </Modale>}
      </>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  LANDING EDUGEST (page de présentation du produit)
// ══════════════════════════════════════════════════════════════

export { MessagesParents };
