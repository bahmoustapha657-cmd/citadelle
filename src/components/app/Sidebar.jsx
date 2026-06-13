// ══════════════════════════════════════════════════════════════
//  Barre latérale de navigation (shell principal)
// ══════════════════════════════════════════════════════════════
import Logo from "../../Logo";
import { C, getAnnee } from "../../constants";
import { moduleLabel, moduleDesc } from "./module-i18n";

export function Sidebar({
  schoolInfo, couleur2, annee, modulesVisibles, page, setPage,
  isMobile, sidebarOuvert, setSidebarOuvert, msgsNonLus,
  utilisateur, utilisateurLabel, deconnecter, estHorsLigne, t,
}) {
  return (
    <aside style={{position:"fixed",top:0,bottom:0,insetInlineStart:0,width:228,zIndex:50,background:schoolInfo.couleur1||C.sidebar,display:"flex",flexDirection:"column",
      transform:isMobile&&!sidebarOuvert?"translateX(-100%)":"translateX(0)",transition:"transform 0.25s ease"}}>
      <div style={{padding:"18px 16px 14px",borderBottom:"1px solid rgba(255,255,255,0.1)",textAlign:"center"}}>
        <Logo width={140} height={46} variant="light"/>
        <div style={{marginTop:10,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          {schoolInfo.logo
            ? <img src={schoolInfo.logo} alt="" style={{width:32,height:32,objectFit:"contain",borderRadius:6,marginBottom:4,display:"block",margin:"0 auto 4px"}}/>
            : null}
          <p style={{margin:0,fontSize:12,fontWeight:800,color:couleur2}}>{schoolInfo.nom}</p>
          <p style={{margin:"2px 0 0",fontSize:9,color:"rgba(255,255,255,0.3)"}}>{schoolInfo.ville||"Kindia"} · {annee||getAnnee()}</p>
        </div>
      </div>
      <nav style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:3,overflowY:"auto",minHeight:0}}>
        {modulesVisibles.map(m=>{
          const actif=page===m.id;
          return <button key={m.id} onClick={()=>{setPage(m.id);if(isMobile)setSidebarOuvert(false);}} style={{
            display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:8,border:"none",cursor:"pointer",textAlign:"start",width:"100%",
            background:actif?`${C.green}22`:"transparent",transition:"background .15s"}}>
            <span style={{fontSize:15}}>{m.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:12,fontWeight:800,color:actif?C.green:"rgba(255,255,255,0.82)"}}>{moduleLabel(m,t)}</p>
              <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.35)"}}>{moduleDesc(m,t)}</p>
            </div>
            {m.id==="messages"&&msgsNonLus>0&&(
              <span style={{background:"#ef4444",color:"#fff",borderRadius:"50%",minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,padding:"0 4px",flexShrink:0}}>
                {msgsNonLus}
              </span>
            )}
            {actif&&msgsNonLus===0&&<div style={{marginInlineStart:"auto",width:5,height:5,borderRadius:"50%",background:C.green,flexShrink:0}}/>}
          </button>;
        })}
      </nav>
      <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:30,height:30,borderRadius:"50%",background:C.green,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>
            {utilisateur.nom[0]}
          </div>
          <div>
            <p style={{margin:0,fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.9)"}}>{utilisateur.nom}</p>
            <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)"}}>{utilisateurLabel}</p>
          </div>
        </div>
        <button onClick={deconnecter} style={{width:"100%",background:"rgba(255,255,255,0.08)",border:"none",color:"rgba(255,255,255,0.5)",padding:"6px",borderRadius:6,fontSize:11,cursor:"pointer",fontWeight:600}}>
          ⬅ {t("auth.logoutAction")}
        </button>
        {estHorsLigne&&(
          <div style={{marginTop:8,background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:6,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:14}}>📡</span>
            <div>
              <p style={{margin:0,fontSize:10,fontWeight:800,color:"#fbbf24"}}>{t("auth.offlineMode")}</p>
              <p style={{margin:0,fontSize:9,color:"rgba(255,255,255,0.4)"}}>{t("auth.offlineNav")}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
