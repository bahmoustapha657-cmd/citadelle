import { AlertesSentryToolbar } from "./alertes-sentry/AlertesSentryToolbar";
import { AlertesSentryTable } from "./alertes-sentry/AlertesSentryTable";

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
      <AlertesSentryToolbar
        sentryIssues={sentryIssues} sentryConfig={sentryConfig} sentryLoading={sentryLoading}
        sentryTesting={sentryTesting} chargerSentry={chargerSentry} testerSentry={testerSentry} S={S}
      />

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

      <AlertesSentryTable sentryIssues={sentryIssues} S={S} />
    </div>
  );
}
