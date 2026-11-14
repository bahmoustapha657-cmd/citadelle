// Configuration partagée des scripts Supabase. Lit EN PRIORITÉ le fichier local
// `config.local.mjs` (tes clés, ignoré par git) ; sinon, les variables
// d'environnement. → Tu n'as donc RIEN à taper dans le terminal.
let local = {};
try {
  local = (await import("./config.local.mjs")).default || {};
} catch {
  // Pas de config.local.mjs : on se rabat sur les variables d'environnement.
}

// On nettoie : espaces/retours accidentels (.trim) et slash final sur l'URL
// (une URL "https://x.supabase.co/" casse les requêtes → "Invalid path").
const clean = (v) => String(v || "").trim();

export const SUPABASE_URL = clean(local.url || process.env.SUPABASE_URL).replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = clean(local.anonKey || process.env.SUPABASE_ANON_KEY);
export const SUPABASE_SERVICE_ROLE = clean(local.serviceRole || process.env.SUPABASE_SERVICE_ROLE);
// Connexion Postgres directe à la base (sauvegarde complète par pg_dump) :
// tableau de bord Supabase → Connect → « Session pooler » (IPv4), mot de passe
// de la base compris. Absente : la sauvegarde complète est sautée, signalée.
export const SUPABASE_DB_URL = clean(local.dbUrl || process.env.SUPABASE_DB_URL);
// Dossier des outils PostgreSQL (pg_dump.exe, psql.exe).
export const PG_BIN = clean(local.pgBin || process.env.EDUGEST_PG_BIN || "C:/Users/ADMIN/outils/pgsql/bin");
