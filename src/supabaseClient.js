// ── Client Supabase (singleton, paresseux) ──────────────────────────────────
// Clés lues depuis l'environnement Vite. La clé ANON est publique par nature :
// la sécurité vient de la RLS Postgres, pas du secret de la clé.
import { createClient } from "@supabase/supabase-js";

const URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const ANON = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabaseConfigured = Boolean(URL && ANON);

// Clé de stockage de la session : la valeur PAR DÉFAUT de supabase-js
// (`sb-<projet>-auth-token`), posée explicitement pour que auth-supabase.js
// puisse relire la session enregistrée sans réseau (getSession() renouvelle
// d'abord un jeton expiré). Même valeur qu'avant : aucune session perdue.
export const CLE_SESSION = (() => {
  try { return `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`; } catch { return ""; }
})();

let client = null;
export function getSupabase() {
  if (client) return client;
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase non configuré : définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local.",
    );
  }
  client = createClient(URL, ANON, {
    auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      ...(CLE_SESSION ? { storageKey: CLE_SESSION } : {}),
    },
  });
  return client;
}

// Utilisateur de la session enregistrée, lu SANS réseau — ou null.
export function uidSessionEnregistree() {
  try {
    return JSON.parse(localStorage.getItem(CLE_SESSION) || "null")?.user?.id || null;
  } catch {
    return null;
  }
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
