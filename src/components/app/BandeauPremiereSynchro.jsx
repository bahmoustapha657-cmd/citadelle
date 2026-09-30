// ══════════════════════════════════════════════════════════════
//  Bandeau « première synchronisation » (mode hors ligne PowerSync)
// ══════════════════════════════════════════════════════════════
// Tant que le miroir local d'un compte n'a jamais été complet sur l'appareil
// (première connexion), les écrans le lisent vide. Sans ce bandeau, des
// listes vides sur réseau faible se lisaient comme « rien ne charge » ; les
// écrans se remplissent seuls à l'arrivée des données (useFirestore).
export function BandeauPremiereSynchro({ premiereSynchro, estHorsLigne, t }) {
  if (!premiereSynchro) return null;
  const pourcent = Math.min(99, Math.floor((premiereSynchro.fraction || 0) * 100));
  return (
    <div role="status" style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", color: "#1e3a8a", padding: "8px 16px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 15 }}>{estHorsLigne ? "📡" : "⏳"}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {estHorsLigne ? t("auth.firstSyncOffline")
          : premiereSynchro.essentielPret ? t("auth.firstSyncRest", { percent: pourcent })
            : t("auth.firstSync", { percent: pourcent })}
      </span>
      {!estHorsLigne && (
        <span aria-hidden="true" style={{ width: 90, height: 6, background: "#dbeafe", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
          <span style={{ display: "block", width: `${pourcent}%`, height: "100%", background: "#3b82f6", transition: "width .4s" }} />
        </span>
      )}
    </div>
  );
}
