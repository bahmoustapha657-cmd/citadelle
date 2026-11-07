import { useTranslation } from "react-i18next";

// Bannière d'alerte abonnement : expiration, période de grâce ou approche de
// la limite du plan gratuit. Ne s'affiche que si un de ces cas est vrai.
export function AbonnementBanniere({ planInfo }) {
  const { t } = useTranslation();
  const banniereVisible = planInfo.planEstExpire || planInfo.enPeriodeGrace
    || (planInfo.joursRestants !== null && planInfo.joursRestants <= 30)
    || (planInfo.planCourant === "gratuit" && planInfo.totalElevesActifs >= 40);
  if (!banniereVisible) return null;

  return (
    <div style={{
      background: planInfo.planEstExpire ? "#fee2e2" : planInfo.enPeriodeGrace ? "#fff7ed" : planInfo.joursRestants <= 7 ? "#fef2f2" : "#fef3c7",
      border: `1px solid ${planInfo.planEstExpire ? "#fca5a5" : planInfo.enPeriodeGrace ? "#fdba74" : planInfo.joursRestants <= 7 ? "#fca5a5" : "#fcd34d"}`,
      borderRadius: 10, padding: "12px 18px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <span style={{ fontSize: 22 }}>
        {planInfo.planEstExpire ? "🔴" : planInfo.enPeriodeGrace ? "🟠" : planInfo.joursRestants <= 7 ? "🔴" : "🟡"}
      </span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: planInfo.planEstExpire ? "#991b1b" : planInfo.enPeriodeGrace ? "#c2410c" : "#92400e" }}>
          {planInfo.planEstExpire
            ? t("dashboard.sub.expiredBanner")
            : planInfo.enPeriodeGrace
              ? t("dashboard.sub.graceBanner", { days: planInfo.joursGrace })
              : planInfo.joursRestants !== null && planInfo.joursRestants <= 30
                ? t("dashboard.sub.expiresIn", { plan: planInfo.planLabel, days: planInfo.joursRestants })
                : t(planInfo.peutAjouterEleve ? "dashboard.sub.freeNearLimit" : "dashboard.sub.freeLimitReached", { count: planInfo.totalElevesActifs })}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
          {planInfo.enPeriodeGrace ? t("dashboard.sub.renewBeforeEnd") : t("dashboard.sub.subscribeToContinue")}
        </p>
      </div>
    </div>
  );
}
