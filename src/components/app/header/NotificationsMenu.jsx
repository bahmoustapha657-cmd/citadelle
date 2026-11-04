import { C } from "../../../constants";

// Ancienneté d'une notification : « À l'instant », « 12 min », « 3 h », « 2 j ».
const anciennete = (age, t) =>
  age < 60000 ? t("shell.notif.justNow")
    : age < 3600000 ? t("shell.notif.minutes", { n: Math.floor(age / 60000) })
      : age < 86400000 ? t("shell.notif.hours", { n: Math.floor(age / 3600000) })
        : t("shell.notif.days", { n: Math.floor(age / 86400000) });

// Cloche de notifications + panneau déroulant listant l'activité récente.
export function NotificationsMenu({
  notifOuvert, setNotifOuvert, setProfilOuvert,
  notifNonLues, marquerNotifLues, notifListe, nowTs, setPage, t,
}) {
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <button onClick={()=>{setNotifOuvert(v=>!v);setProfilOuvert(false);marquerNotifLues();}}
        title={t("shell.notif.title")}
        style={{position:"relative",background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:16,lineHeight:1}}>
        🔔
        {notifNonLues>0&&<span style={{position:"absolute",top:-4,insetInlineEnd:-4,background:"#ef4444",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{notifNonLues}</span>}
      </button>
      {notifOuvert&&(
        <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",insetInlineEnd:0,width:320,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontWeight:800,fontSize:13,color:"#0f172a"}}>{t("shell.notif.recent")}</span>
            <button onClick={()=>setNotifOuvert(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8",padding:0}}>✕</button>
          </div>
          <div style={{maxHeight:320,overflowY:"auto"}}>
            {notifListe.length===0
              ? <div style={{padding:"24px 16px",textAlign:"center",color:"#94a3b8",fontSize:12}}>{t("shell.notif.none")}</div>
              : notifListe.map((n,i)=>{
                  const age=nowTs-n.date;
                  const isNew=age<5*60*1000;
                  return <div key={n.id||i} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",background:isNew?"#f0fdf4":"#fff",display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:isNew?"#22c55e":"#e2e8f0",marginTop:5,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:12,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.action}</p>
                      {n.details&&<p style={{margin:"2px 0 0",fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.details}</p>}
                    </div>
                    <span style={{fontSize:10,color:"#94a3b8",flexShrink:0,marginTop:2}}>{anciennete(age,t)}</span>
                  </div>;
                })
            }
          </div>
          <div style={{padding:"8px 16px",borderTop:"1px solid #f1f5f9"}}>
            <button onClick={()=>{setNotifOuvert(false);setPage("historique");}} style={{width:"100%",background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.blue,fontWeight:700,padding:"4px 0",textAlign:"center"}}>
              {t("shell.notif.seeAll")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
