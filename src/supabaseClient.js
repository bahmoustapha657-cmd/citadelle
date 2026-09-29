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

// Client JETABLE : session en mémoire seulement, clé de stockage distincte.
// La récupération de mot de passe y ouvre sa session sans toucher à celle de
// l'application : aucun onAuthStateChange côté app (chargement du compte,
// connexion PowerSync), et un autre compte déjà connecté sur l'appareil le
// reste.
export function creerClientEphemere() {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase non configuré : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local.",
    );
  }
  return createClient(URL, ANON, {
    auth: {
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: "edugest-recuperation",
    },
  });
}
