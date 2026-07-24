// ── Déclenchement des notifications parents (SMS / WhatsApp) ─────────────────
// Fire-and-forget : appelle l'Edge Function `notify` sans jamais bloquer ni
// faire échouer l'action métier (paiement, absence, annonce). Tout se décide
// côté serveur (réglages de l'école, résolution du tél, anti-doublon, envoi).
// No-op en mode Firebase (backend gelé) — seul le mode Supabase est concerné.
import { getSupabase } from "../supabaseClient";
import { isSupabase } from "../backend";

// type ∈ 'paiement' | 'absence' | 'annonce'
// opts : { eleveId?, data? }  (data = champs du gabarit : nomEleve, mois, date, titre, corps…)
export function notifierParents(type, { eleveId = null, data = {} } = {}) {
  if (!isSupabase) return;
  const schoolId = localStorage.getItem("LC_schoolId");
  if (!schoolId || schoolId === "superadmin") return;
  try {
    // invoke renvoie une promesse : on l'ignore volontairement (best-effort).
    getSupabase().functions.invoke("notify", {
      body: { schoolId, type, eleveId, data },
    }).catch(() => {});
  } catch {
    // Ne jamais interrompre l'action métier pour une notification.
  }
}
