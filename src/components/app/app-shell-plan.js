// Calcul pur du plan d'abonnement (freemium + période de grâce 3 jours).
import { PLANS } from "../../constants";
import { estPremiumActif } from "../../../shared/plan-features.js";

const GRACE_MS = 3 * 86400000; // 3 jours de grâce après expiration

// Portails enseignant et parent (même règle que le refus de la base,
// supabase/ecole-hors-service.sql) : ils ne renouvellent pas, ils consultent.
export const MSG_LECTURE_SEULE_PORTAIL = "L'abonnement de l'établissement a expiré : consultation seule, aucune modification possible.";

export function computePlanInfo({ schoolInfoState, nowTs, totalElevesActifs, t }) {
  const planCourant = schoolInfoState.plan || "gratuit";
  // Nombre obligatoire : une chaîne ferait de `planExpiry + GRACE_MS` une
  // concaténation, et la grâce ne finirait jamais.
  const planExpiry = Number(schoolInfoState.planExpiry) || null;
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
    // Fonctions facturées à l'usage (notifications SMS/WhatsApp, génération
    // d'appréciations). Sert uniquement à griser l'UI : l'autorité reste le
    // contrôle serveur des Edge Functions `notify` et `ia`.
    estPremium: estPremiumActif({ plan: planCourant, planExpiry, now }),
    planLabel: t(`plans.${planCourant}`, PLANS[planCourant]?.label ?? "Gratuit"),
  };
}
