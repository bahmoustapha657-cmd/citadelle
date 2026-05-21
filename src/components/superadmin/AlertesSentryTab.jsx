import React from "react";
import { C } from "../../constants";

// Onglet "Alertes Sentry" du Panel Super-Admin.
// Affiche la liste des dernières issues remontées par Sentry et permet
// de tester la pipeline de capture. Les chargeurs (chargerSentry,
// testerSentry) vivent dans le parent pour pouvoir réinitialiser
// l'erreur globale via setMsgSucces.
export function AlertesSentryTab({
  sentryIssues,
  sentryConfig,
  sentryLoading,
  sentryTesting,
  sentryError,
  chargerSentry,
  testerSentry,
  S,
}) {
  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={chargerSentry} disabled={sentryLoading}
          style={{...S.btn("#6b7280"),background:"#f3f4f6",color:"#374151",padding:"8px 14px",fontSize:13,opacity:sentryLoading?0.6:1}}>
          {sentryLoading ? "Chargement..." : "Actualiser"}
        </button>
        <button onClick={testerSentry} disabled={sentryTesting}
          style={{...S.btn("#6b7280"),background:"#fef3c7",color:"#92400e",padding:"8px 14px",fontSize:13,opacity:sentryTesting?0.6:1}}
          title="Declenche une exception capturee par Sentry pour valider la pipeline">
          {sentryTesting ? "Envoi..." : "Tester la capture"}
        </button>
        {sentryConfig?.dashboardUrl && (
          <a href={sentryConfig.dashboardUrl} target="_blank" rel="noopener noreferrer"
            style={{...S.btn("#6b7280"),background:"#eef2ff",color:"#3730a3",padding:"8px 14px",fontSize:13,textDecoration:"none",display:"inline-block"}}>
            Ouvrir Sentry ↗
          </a>
        )}
        {sentryConfig && (
          <span style={{fontSize:11,color:"#64748b",marginLeft:"auto"}}>
            {sentryConfig.configured
              ? `${sentryConfig.org}/${sentryConfig.project} · ${sentryIssues.length} issue(s) chargee(s)`
              : "Sentry non configure cote serveur."}
          </span>
        )}
      </div>

      {sentryError && (
        <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#991b1b"}}>
          {sentryError}
        </div>
      )}

      {sentryConfig && !sentryConfig.configured && (
        <div style={{background:"#fef3c7",border:"1px solid #fbbf24",borderRadius:10,padding:"14px 18px",fontSize:12,color:"#92400e",lineHeight:1.6}}>
          <p style={{margin:"0 0 8px",fontWeight:700}}>Configuration requise</p>
          <p style={{margin:0}}>
            Definir les env vars cote serveur : <code>SENTRY_AUTH_TOKEN</code>, <code>SENTRY_ORG_SLUG</code>, <code>SENTRY_PROJECT_SLUG</code>. Le token doit avoir les scopes <code>event:read</code> et <code>project:read</code>.
          </p>
        </div>
      )}

      {sentryConfig?.configured && sentryIssues.length===0 && !sentryLoading && !sentryError && (
        <div style={{padding:40,textAlign:"center",color:"#9ca3af",background:"#fff",borderRadius:12}}>
          Aucune issue Sentry sur les 14 derniers jours.
        </div>
      )}

      {sentryIssues.length>0 && (
        <div style={S.card}>
          <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
            <thead>
              <tr>
                {["Niveau","Titre","Occurrences","Utilisateurs","Derniere vue",""].map(h=>(
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sentryIssues.map(is=>{
                const lvlColor = is.level==="fatal"||is.level==="error" ? "#dc2626" : is.level==="warning" ? "#d97706" : "#6b7280";
                return (
                  <tr key={is.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                    <td style={{...S.td,fontSize:11}}>
                      <span style={{padding:"2px 8px",borderRadius:8,background:`${lvlColor}22`,color:lvlColor,fontWeight:700,textTransform:"uppercase"}}>{is.level||"info"}</span>
                    </td>
                    <td style={{...S.td,fontWeight:600,maxWidth:480}}>
                      <div style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{is.title}</div>
                      {is.culprit && <div style={{fontSize:11,color:"#64748b",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{is.culprit}</div>}
                    </td>
                    <td style={{...S.td,fontWeight:700}}>{is.count}</td>
                    <td style={S.td}>{is.userCount}</td>
                    <td style={{...S.td,fontSize:11,color:"#64748b"}}>{is.lastSeen ? new Date(is.lastSeen).toLocaleString("fr-FR") : "—"}</td>
                    <td style={S.td}>
                      {is.permalink && <a href={is.permalink} target="_blank" rel="noopener noreferrer" style={{color:C.blue,fontSize:12,fontWeight:700,textDecoration:"none"}}>Voir ↗</a>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
