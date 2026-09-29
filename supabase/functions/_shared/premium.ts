// ── Premium : miroir de shared/plan-features.js ──────────────────────────────
// Chaque SMS/WhatsApp est facturé : notify (alertes) et password-reset (code
// de réinitialisation) ne les envoient qu'aux écoles du plan Premium. Deno ne
// partage pas shared/plan-features.js : tests/reinitialisation-code.test.js
// vérifie que les deux rendent le même verdict. (ia/index.ts garde sa copie.)
export const PLANS_PREMIUM = ["premium"];
const GRACE_MS = 3 * 86400000; // 3 jours de grâce après l'échéance

export function estPremiumActif(plan: unknown, planExpiry: unknown, now: number = Date.now()): boolean {
  if (typeof plan !== "string" || !PLANS_PREMIUM.includes(plan)) return false;
  if (!planExpiry) return true; // premium sans échéance (offert / illimité)
  return now < Number(planExpiry) + GRACE_MS;
}
