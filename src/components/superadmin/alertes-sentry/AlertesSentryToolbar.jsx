// Barre d'actions de l'onglet Alertes Sentry : actualiser, tester la capture,
// lien vers le dashboard et statut de configuration.
export function AlertesSentryToolbar({ sentryIssues, sentryConfig, sentryLoading, sentryTesting, chargerSentry, testerSentry, S }) {
  return (
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
  );
}
