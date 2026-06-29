// ── Client Supabase (singleton, paresseux) ──────────────────────────────────
// Clés lues depuis l'environnement Vite. La clé ANON est publique par nature :
// la sécurité vient de la RLS Postgres, pas du secret de la clé.
import { createClient } from "@supabase/supabase-js";

const URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigured = Boolean(URL && ANON);

let client = null;
export function getSupabase() {
  if (client) return client;
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase non configuré : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local.",
    );
  }
  client = createClient(URL, ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
