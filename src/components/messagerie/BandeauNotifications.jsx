import { useTranslation } from "react-i18next";

// Sans notifications, l'appareil ne sait rien d'un appel ou d'un message tant
// que l'application est fermée : on le dit là où l'on s'en sert.
const TEXTES = {
  default: "msg.notif.enable",
  denied: "msg.notif.blocked",
  indisponible: "msg.notif.unavailable",
};

export function BandeauNotifications({ notifications }) {
  const { t } = useTranslation();
  const cle = TEXTES[notifications?.etat];
  if (!cle) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, lineHeight: 1.35, borderBottom: "1px solid var(--lc-border)" }}>
      <span style={{ flex: 1 }}>🔔 {t(cle)}</span>
      {notifications.etat === "default" && (
        <button type="button" onClick={notifications.activer}
          style={{ flexShrink: 0, background: "#92400e", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          {t("msg.notif.activate")}
        </button>
      )}
    </div>
  );
}
