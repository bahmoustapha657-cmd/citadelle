// ══════════════════════════════════════════════════════════════
//  En-tête du shell : titre module, recherche, thème, cloche, profil
// ══════════════════════════════════════════════════════════════
import { C } from "../../constants";
import { Badge } from "../ui";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { moduleLabel } from "./module-i18n";

export function AppHeader({
  isMobile, setSidebarOuvert, modulesVisibles, page, readOnly, t,
  estHorsLigne, planInfo, utilisateur, utilisateurLabel, schoolInfo,
  setRechercheOuverte, modeSombre, setModeSombre,
  notifOuvert, setNotifOuvert, notifNonLues, setNotifNonLues, notifListe, nowTs,
  profilOuvert, setProfilOuvert, setPage, setAideOuverte, deconnecter,
}) {
  return (
    <header style={{background:"#fff",borderBottom:`3px solid ${C.green}`,padding:"0 12px",height:52,display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:30,minWidth:0}}>
      {/* Bouton hamburger mobile */}
      <button onClick={()=>setSidebarOuvert(v=>!v)} style={{display:isMobile?"flex":"none",flexShrink:0,alignItems:"center",justifyContent:"center",background:"none",border:"none",cursor:"pointer",padding:6,borderRadius:6,color:C.blueDark,fontSize:22}}>
        ☰
      </button>
      <div style={{flex:1,minWidth:0,overflow:"hidden"}}>
        <span style={{fontSize:14,fontWeight:800,color:C.blueDark,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"block"}}>
          {modulesVisibles.find(m=>m.id===page)?.icon} {(()=>{const m=modulesVisibles.find(m=>m.id===page);return m?moduleLabel(m,t):"";})()}
        </span>
        {readOnly&&!isMobile&&<span style={{marginInlineStart:10,fontSize:11,color:"#d97706",fontWeight:700,background:"#fef3e0",padding:"2px 8px",borderRadius:10}}>👁️ {t("common.readOnly")}</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        {estHorsLigne&&(
          <div title="Mode hors ligne — données depuis le cache" style={{display:"flex",alignItems:"center",gap:4,background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,color:"#92400e",flexShrink:0}}>
            <span style={{fontSize:13}}>📡</span>
            {!isMobile&&<span>Hors ligne</span>}
          </div>
        )}
        {/* ── Alerte expiration abonnement ── */}
        {planInfo && planInfo.joursRestants !== null && planInfo.joursRestants <= 30 && ["admin","direction"].includes(utilisateur?.role) && (
          <div title={`Abonnement ${planInfo.planLabel} — expire dans ${planInfo.joursRestants} jour(s)`}
            style={{display:"flex",alignItems:"center",gap:4,
              background: planInfo.joursRestants<=7?"#fee2e2":"#fef3c7",
              border:`1px solid ${planInfo.joursRestants<=7?"#f87171":"#f59e0b"}`,
              borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,
              color:planInfo.joursRestants<=7?"#b91c1c":"#92400e",flexShrink:0,cursor:"default"}}>
            <span style={{fontSize:13}}>{planInfo.joursRestants<=7?"🔴":"🟡"}</span>
            {!isMobile&&<span>Abonnement : {planInfo.joursRestants<=0?"EXPIRÉ":`${planInfo.joursRestants}j`}</span>}
          </div>
        )}
        <button onClick={()=>setRechercheOuverte(true)}
          title="Recherche globale (Ctrl+K)"
          style={{display:"flex",alignItems:"center",gap:isMobile?0:6,background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:isMobile?17:12,color:"#6b7280",fontWeight:600}}>
          🔍{!isMobile&&<><span>{t("common.search")}</span><kbd style={{background:"#e2e8f0",border:"1px solid #cbd5e1",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#94a3b8",marginInlineStart:4}}>Ctrl K</kbd></>}
        </button>
        <button onClick={()=>setModeSombre(v=>!v)}
          title={modeSombre?"Mode clair":"Mode sombre"}
          style={{background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:16,lineHeight:1}}>
          {modeSombre?"☀️":"🌙"}
        </button>

        {/* ── Cloche notifications ── */}
        <div style={{position:"relative",flexShrink:0}}>
          <button onClick={()=>{setNotifOuvert(v=>!v);setProfilOuvert(false);setNotifNonLues(0);}}
            title="Notifications récentes"
            style={{position:"relative",background:"#f0f4f0",border:"1px solid #e0ebf8",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:16,lineHeight:1}}>
            🔔
            {notifNonLues>0&&<span style={{position:"absolute",top:-4,insetInlineEnd:-4,background:"#ef4444",color:"#fff",borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{notifNonLues}</span>}
          </button>
          {notifOuvert&&(
            <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",insetInlineEnd:0,width:320,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontWeight:800,fontSize:13,color:"#0f172a"}}>Activité récente</span>
                <button onClick={()=>setNotifOuvert(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8",padding:0}}>✕</button>
              </div>
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {notifListe.length===0
                  ? <div style={{padding:"24px 16px",textAlign:"center",color:"#94a3b8",fontSize:12}}>Aucune activité récente</div>
                  : notifListe.map((n,i)=>{
                      const age=nowTs-n.date;
                      const ageStr=age<60000?"À l'instant":age<3600000?`${Math.floor(age/60000)}min`:age<86400000?`${Math.floor(age/3600000)}h`:`${Math.floor(age/86400000)}j`;
                      const isNew=age<5*60*1000;
                      return <div key={n.id||i} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",background:isNew?"#f0fdf4":"#fff",display:"flex",gap:10,alignItems:"flex-start"}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:isNew?"#22c55e":"#e2e8f0",marginTop:5,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{margin:0,fontSize:12,fontWeight:700,color:"#1e293b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.action}</p>
                          {n.details&&<p style={{margin:"2px 0 0",fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{n.details}</p>}
                        </div>
                        <span style={{fontSize:10,color:"#94a3b8",flexShrink:0,marginTop:2}}>{ageStr}</span>
                      </div>;
                    })
                }
              </div>
              <div style={{padding:"8px 16px",borderTop:"1px solid #f1f5f9"}}>
                <button onClick={()=>{setNotifOuvert(false);setPage("historique");}} style={{width:"100%",background:"none",border:"none",cursor:"pointer",fontSize:11,color:C.blue,fontWeight:700,padding:"4px 0",textAlign:"center"}}>
                  Voir tout l'historique →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Avatar + menu profil ── */}
        <div style={{position:"relative",flexShrink:0}}>
          <button onClick={()=>{setProfilOuvert(v=>!v);setNotifOuvert(false);}}
            title="Mon profil"
            style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",padding:"3px 6px",borderRadius:8}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:C.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>
              {utilisateur.nom[0]}
            </div>
            {!isMobile&&<>
              <span style={{fontSize:12,fontWeight:700,color:C.blueDark}}>{utilisateur.nom}</span>
              <Badge color={utilisateur.role==="admin"?"purple":utilisateur.role==="comptable"?"teal":"blue"}>{utilisateurLabel}</Badge>
            </>}
          </button>
          {profilOuvert&&(
            <div onClick={e=>e.stopPropagation()} style={{position:"absolute",top:"calc(100% + 8px)",insetInlineEnd:0,width:220,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,boxShadow:"0 10px 40px rgba(0,0,0,0.15)",zIndex:200,overflow:"hidden"}}>
              <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",background:"#f8fafc"}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:"#0f172a"}}>{utilisateur.nom}</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#64748b"}}>{utilisateurLabel} · {schoolInfo.nom}</p>
              </div>
              {["admin","direction","comptable","superadmin"].includes(utilisateur.role)&&(
                <button onClick={()=>{setProfilOuvert(false);setPage("parametres");}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"start",fontWeight:600}}>
                  🏫 <span>Paramètres école</span>
                </button>
              )}
              <button onClick={()=>{setProfilOuvert(false);setAideOuverte(true);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#374151",textAlign:"start",fontWeight:600,borderBottom:"1px solid #f1f5f9"}}>
                ⌨️ <span>{t("nav.shortcuts")}</span><kbd style={{marginInlineStart:"auto",background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#94a3b8"}}>?</kbd>
              </button>
              <div style={{padding:"10px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:14}}>🌐</span>
                <span style={{fontSize:12,fontWeight:600,color:"#374151",flex:1}}>{t("common.language")}</span>
                <LanguageSwitcher compact />
              </div>
              <button onClick={()=>{setProfilOuvert(false);deconnecter();}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#ef4444",textAlign:"start",fontWeight:700}}>
                ⬅ <span>{t("auth.logout")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
