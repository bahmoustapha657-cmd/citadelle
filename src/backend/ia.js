// ── Assistant IA — aiguillage backend ───────────────────────────────────────
// Firebase (prod) : POST /api/ia. Supabase : Edge Function `ia`. Même contrat
// { action, payload } → { ok, result } | { ok:false, error }.
import { isSupabase } from "../backend";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { getSupabase } from "../supabaseClient";

async function appelerIA(action, payload) {
  if (isSupabase) {
    const { data, error } = await getSupabase().functions.invoke("ia", { body: { action, payload } });
    if (error) {
      let msg = "Service IA indisponible.";
      try { msg = (await error.context?.json())?.error || msg; } catch { /* défaut */ }
      return { ok: false, error: msg };
    }
    return data?.ok ? data : { ok: false, error: data?.error || "Réponse vide." };
  }
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await apiFetch("/ia", { method: "POST", headers, body: JSON.stringify({ action, payload }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) return { ok: false, error: data.error || "Service IA indisponible." };
  return data;
}

// Génère une appréciation de bulletin (personnel pédagogique). Marche en prod
// Firebase ET sur Supabase.
export function genererAppreciation(payload) {
  return appelerIA("assistant_appreciation", payload);
}

// Assistant du superadmin (rédaction support/annonce/incident/commercial).
export function assistantSuperadmin(payload) {
  return appelerIA("assistant_superadmin", payload);
}
