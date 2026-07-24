// ── Fonctionnalités réservées au plan Premium ───────────────────────────────
// Ces deux fonctions engagent un COÛT RÉEL par usage (API d'IA facturée au
// jeton, SMS/WhatsApp facturés au message) : elles sont donc réservées au plan
// Premium. Le blocage qui fait autorité est côté SERVEUR (Edge Functions `ia`
// et `notify`, qui rejouent cette même règle) — l'UI ne fait qu'éviter à
// l'utilisateur une action vouée à l'échec.
//
// ⚠️ Toute évolution ici doit être répercutée dans les deux Edge Functions
// (supabase/functions/ia/index.ts et supabase/functions/notify/index.ts), qui
// dupliquent volontairement `estPremiumActif` (Deno ne partage pas ce module).

export const FONCTIONS_PREMIUM = {
  notifications: {
    label: "Notifications SMS / WhatsApp",
    desc: "Alertes automatiques aux tuteurs (paiements, absences, annonces).",
  },
  appreciations_ia: {
    label: "Génération d'appréciations",
    desc: "Rédaction automatique des appréciations de bulletin.",
  },
};

// Plans donnant accès aux fonctions premium. Un seul aujourd'hui, mais la
// liste évite d'éparpiller des comparaisons `=== "premium"` dans le code.
export const PLANS_PREMIUM = ["premium"];

const GRACE_MS = 3 * 86400000; // 3 jours — aligné sur computePlanInfo

// Premium actif ? Le plan doit être premium ET non expiré. La période de
// grâce (3 j après échéance) reste couverte, comme pour les limites d'élèves :
// on ne coupe pas un service payant du jour au lendemain.
export function estPremiumActif({ plan, planExpiry, now = Date.now() } = {}) {
  if (!PLANS_PREMIUM.includes(plan)) return false;
  if (!planExpiry) return true; // premium sans échéance (offert / illimité)
  return now < planExpiry + GRACE_MS;
}

// Message unique pour l'UI et les réponses serveur (cohérence du discours).
export const MESSAGE_PREMIUM = "Cette fonctionnalité est réservée au plan Premium.";
