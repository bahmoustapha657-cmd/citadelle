// ── Assistant IA ────────────────────────────────────────────────────────────
// Edge Function `ia`. Contrat { action, payload } → { ok, result } |
// { ok:false, error }.
import { getSupabase } from "../supabaseClient";

async function appelerIA(action, payload) {
  const { data, error } = await getSupabase().functions.invoke("ia", { body: { action, payload } });
  if (error) {
    let msg = "Service IA indisponible.";
    try { msg = (await error.context?.json())?.error || msg; } catch { /* défaut */ }
    return { ok: false, error: msg };
  }
  return data?.ok ? data : { ok: false, error: data?.error || "Réponse vide." };
}

// Génère une appréciation de bulletin (personnel pédagogique).
export function genererAppreciation(payload) {
  return appelerIA("assistant_appreciation", payload);
}

// Assistant du superadmin (rédaction support/annonce/incident/commercial).
export function assistantSuperadmin(payload) {
  return appelerIA("assistant_superadmin", payload);
}
