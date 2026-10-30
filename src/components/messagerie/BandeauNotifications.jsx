// Sans notifications, l'appareil ne sait rien d'un appel ou d'un message tant
// que l'application est fermée : on le dit là où l'on s'en sert.
const TEXTES = {
  default: "Activez les notifications pour être prévenu d'un appel ou d'un message quand l'application est fermée.",
  denied: "Notifications bloquées sur cet appareil : autorisez-les pour ce site dans les réglages du navigateur, sinon vous ne verrez pas vos appels quand l'application est fermée.",
  indisponible: "Cet appareil ne peut pas recevoir de notifications. Sur iPhone, ajoutez d'abord EduGest à l'écran d'accueil.",
};

export function BandeauNotifications({ notifications }) {
  const texte = TEXTES[notifications?.etat];
  if (!texte) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, lineHeight: 1.35, borderBottom: "1px solid var(--lc-border)" }}>
      <span style={{ flex: 1 }}>🔔 {texte}</span>
      {notifications.etat === "default" && (
        <button type="button" onClick={notifications.activer}
          style={{ flexShrink: 0, background: "#92400e", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          Activer
        </button>
      )}
    </div>
  );
}
