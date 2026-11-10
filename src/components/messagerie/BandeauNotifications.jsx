import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GuideIphone } from "../installation-iphone/GuideIphone";
import { conseilNotifications, situationApple } from "../installation-iphone/iphone";

// Sans notifications, l'appareil ne sait rien d'un appel ou d'un message tant
// que l'application est fermée : on le dit là où l'on s'en sert. Sur iPhone,
// on montre comment y arriver (installation-iphone/iphone.js).
const styleBouton = { flexShrink: 0, background: "#92400e", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer" };

export function BandeauNotifications({ notifications }) {
  const { t } = useTranslation();
  const [guide, setGuide] = useState(false);
  const conseil = conseilNotifications(notifications?.etat, situationApple());
  if (!conseil) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 600, lineHeight: 1.35, borderBottom: "1px solid var(--lc-border)" }}>
      <span style={{ flex: 1, textAlign: "start" }}>🔔 {t(conseil.cle, { version: conseil.version })}</span>
      {conseil.activer && (
        <button type="button" onClick={notifications.activer} style={styleBouton}>
          {t("msg.notif.activate")}
        </button>
      )}
      {conseil.guide && (
        <button type="button" onClick={() => setGuide(true)} style={styleBouton}>
          {t("install.ios.how")}
        </button>
      )}
      {guide && <GuideIphone fermer={() => setGuide(false)} />}
    </div>
  );
}
