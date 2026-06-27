// Configuration partagée des scripts Supabase. Lit EN PRIORITÉ le fichier local
// `config.local.mjs` (tes clés, ignoré par git) ; sinon, les variables
// d'environnement. → Tu n'as donc RIEN à taper dans le terminal.
let local = {};
try {
  local = (await import("./config.local.mjs")).default || {};
} catch {
  // Pas de config.local.mjs : on se rabat sur les variables d'environnement.
}

export const SUPABASE_URL = local.url || process.env.SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = local.anonKey || process.env.SUPABASE_ANON_KEY || "";
export const SUPABASE_SERVICE_ROLE = local.serviceRole || process.env.SUPABASE_SERVICE_ROLE || "";
