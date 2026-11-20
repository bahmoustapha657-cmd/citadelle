import { useTranslation } from "react-i18next";
import { libelleSection } from "../../i18n/libelles";
import { Btn } from "../ui";

// Alerte « 📤 N départ(s) signalé(s) à confirmer » : en tête de la
// Comptabilité (le comptable n'a pas d'autre tableau de bord) et sur le
// tableau de bord de la Direction. `compte` : { total, parSection } (cf.
// compterSignalementsParSection) ; `ouvrir()` mène à la fenêtre de
// Comptabilité → Élèves. Rien tant qu'il n'y a rien à confirmer.
export function AlerteDepartsSignales({ compte, ouvrir = null, style = null }) {
  const { t } = useTranslation();
  if (!compte?.total) return null;
  return (
    <div role="status" data-testid="alerte-departs-signales"
      style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#78350f", ...style }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontWeight: 800 }}>📤 {t("departsSignales.alertTitle", { count: compte.total })}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: "#92400e" }}>
          {t("departsSignales.alertDesc", {
            detail: compte.parSection.map((s) => `${libelleSection(s.section)} : ${s.nombre}`).join(" · "),
          })}
        </div>
      </div>
      {ouvrir && <Btn sm v="amber" onClick={ouvrir}>{t("departsSignales.alertBtn")}</Btn>}
    </div>
  );
}
