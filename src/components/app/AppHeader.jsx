// ══════════════════════════════════════════════════════════════
//  En-tête du shell : titre module, recherche, thème, cloche, profil
// ══════════════════════════════════════════════════════════════
import { C } from "../../constants";
import { isSupabase } from "../../backend";
import { moduleLabel } from "./module-i18n";
import { NotificationsMenu } from "./header/NotificationsMenu";
import { ProfilMenu } from "./header/ProfilMenu";
import { MessagerieInterne } from "../messagerie/MessagerieInterne";

// Rôles hors messagerie interne (portails dédiés + superadmin transversal).
const SANS_MESSAGERIE = new Set(["parent", "enseignant", "superadmin"]);

export function AppHeader({
  isMobile, setSidebarOuvert, modulesVisibles, page, readOnly, abonnementExpire, t,
  estHorsLigne, syncPendantes, planInfo, utilisateur, utilisateurLabel, schoolInfo,
  setRechercheOuverte, modeSombre, setModeSombre,
  notifOuvert, setNotifOuvert, notifNonLues, setNotifNonLues, notifListe, nowTs,
  profilOuvert, setProfilOuvert, setPage, setAideOuverte, setCentreAideOuvert, deconnecter,
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
        {readOnly&&!isMobile&&(abonnementExpire
          ? <span style={{marginInlineStart:10,fontSize:11,color:"#b91c1c",fontWeight:700,background:"#fee2e2",padding:"2px 8px",borderRadius:10}}>🔒 {t("common.subscriptionExpiredReadOnly")}</span>
          : <span style={{marginInlineStart:10,fontSize:11,color:"#d97706",fontWeight:700,background:"#fef3e0",padding:"2px 8px",borderRadius:10}}>👁️ {t("common.readOnly")}</span>)}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        {estHorsLigne&&(
          <div title={t("auth.headerOffline")} style={{display:"flex",alignItems:"center",gap:4,background:"#fef3c7",border:"1px solid #f59e0b",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,color:"#92400e",flexShrink:0}}>
            <span style={{fontSize:13}}>📡</span>
            {!isMobile&&<span>{t("auth.offlineShort")}</span>}
          </div>
        )}
        {/* ── Notes/absences saisies hors ligne pas encore remontées (PowerSync) ── */}
        {!!syncPendantes&&(
          <div title={t("auth.syncPendingTitle", { count: syncPendantes })} style={{display:"flex",alignItems:"center",gap:4,background:"#dbeafe",border:"1px solid #60a5fa",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,color:"#1e40af",flexShrink:0}}>
            <span style={{fontSize:13}}>🔄</span>
            {!isMobile&&<span>{t("auth.syncPendingShort", { count: syncPendantes })}</span>}
          </div>
        )}
        {/* ── Alerte expiration abonnement ── */}
        {planInfo && planInfo.joursRestants !== null && planInfo.joursRestants <= 30 && ["admin","direction"].includes(utilisateur?.role) && (
          <div title={t("subscription.expiresTitle", { plan: planInfo.planLabel, days: planInfo.joursRestants })}
            style={{display:"flex",alignItems:"center",gap:4,
              background: planInfo.joursRestants<=7?"#fee2e2":"#fef3c7",
              border:`1px solid ${planInfo.joursRestants<=7?"#f87171":"#f59e0b"}`,
              borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:700,
              color:planInfo.joursRestants<=7?"#b91c1c":"#92400e",flexShrink:0,cursor:"default"}}>
            <span style={{fontSize:13}}>{planInfo.joursRestants<=7?"🔴":"🟡"}</span>
            {!isMobile&&<span>{t("subscription.label")} : {planInfo.joursRestants<=0?t("subscription.expired"):t("subscription.daysShort",{days:planInfo.joursRestants})}</span>}
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

        {/* Messagerie interne du personnel (mode Supabase uniquement). */}
        {isSupabase && utilisateur && !SANS_MESSAGERIE.has(utilisateur.role) && (
          <MessagerieInterne utilisateur={utilisateur} />
        )}

        <NotificationsMenu
          notifOuvert={notifOuvert} setNotifOuvert={setNotifOuvert} setProfilOuvert={setProfilOuvert}
          notifNonLues={notifNonLues} setNotifNonLues={setNotifNonLues}
          notifListe={notifListe} nowTs={nowTs} setPage={setPage}
        />

        <ProfilMenu
          profilOuvert={profilOuvert} setProfilOuvert={setProfilOuvert} setNotifOuvert={setNotifOuvert}
          isMobile={isMobile} utilisateur={utilisateur} utilisateurLabel={utilisateurLabel}
          schoolInfo={schoolInfo} t={t} setPage={setPage} setAideOuverte={setAideOuverte} setCentreAideOuvert={setCentreAideOuvert} deconnecter={deconnecter}
        />
      </div>
    </header>
  );
}
