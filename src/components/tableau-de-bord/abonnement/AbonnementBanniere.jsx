// Bannière d'alerte abonnement : expiration, période de grâce ou approche de
// la limite du plan gratuit. Ne s'affiche que si un de ces cas est vrai.
export function AbonnementBanniere({ planInfo }) {
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
            ? "Abonnement expiré — accès limité à 50 élèves"
            : planInfo.enPeriodeGrace
              ? `Période de grâce — encore ${planInfo.joursGrace} jour(s) d'accès complet`
              : planInfo.joursRestants !== null && planInfo.joursRestants <= 30
                ? `Abonnement ${planInfo.planLabel} expire dans ${planInfo.joursRestants} jour(s)`
                : `Plan Gratuit : ${planInfo.totalElevesActifs}/50 élèves — bientôt à la limite`}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
          {planInfo.enPeriodeGrace
            ? "Renouvelez votre abonnement avant la fin de la période de grâce pour ne pas perdre l'accès."
            : "Souscrivez un abonnement pour continuer à inscrire des élèves sans limite."}
        </p>
      </div>
    </div>
  );
}
