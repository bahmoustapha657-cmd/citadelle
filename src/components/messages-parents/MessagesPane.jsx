import { Btn, Card } from "../ui";

// Onglet "Messages" : liste des conversations à gauche, détail/fil et zone
// de réponse à droite.
export function MessagesPane({ c1, threads, threadSelec, selMsg, setSelMsg, marquerLus, reponse, setRep, envoyerReponse, readOnly }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:16,minHeight:400}}>
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
    </div>
  );
}
