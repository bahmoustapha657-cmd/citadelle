// Calcul pur du plan d'abonnement (freemium + période de grâce 3 jours).
import { PLANS } from "../../constants";

const GRACE_MS = 3 * 86400000; // 3 jours de grâce après expiration

export function computePlanInfo({ schoolInfoState, nowTs, totalElevesActifs, t }) {
  const planCourant = schoolInfoState.plan || "gratuit";
  const planExpiry = schoolInfoState.planExpiry || null;
  const now = nowTs;
  const planExpiryBrut = planCourant !== "gratuit" && planExpiry && now > planExpiry;
  const enPeriodeGrace = planExpiryBrut && now < planExpiry + GRACE_MS;
  const planEstExpire = planExpiryBrut && !enPeriodeGrace; // vraiment expiré (après grâce)
  const joursGrace = enPeriodeGrace ? Math.ceil((planExpiry + GRACE_MS - now) / 86400000) : null;
  const joursRestants = planExpiry && !planExpiryBrut ? Math.ceil((planExpiry - now) / 86400000) : null;
  // Pendant la période de grâce : on garde les limites du plan payant
  const eleveLimit = planEstExpire
    ? PLANS.gratuit.eleveLimit
    : (PLANS[planCourant]?.eleveLimit ?? PLANS.gratuit.eleveLimit);
  return {
    planCourant,
    planExpiry,
    planEstExpire,
    enPeriodeGrace,
    joursGrace,
    joursRestants,
    eleveLimit,
    totalElevesActifs,
    peutAjouterEleve: totalElevesActifs < eleveLimit,
    planLabel: t(`plans.${planCourant}`, PLANS[planCourant]?.label ?? "Gratuit"),
  };
}
