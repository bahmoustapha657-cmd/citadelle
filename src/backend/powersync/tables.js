// ── Périmètre hors ligne (TOTAL, sauf portail parent) ───────────────────────
// Tables Supabase mises en miroir localement via PowerSync. Restent en ligne :
// portail parent (vague ultérieure), paiements en ligne, messagerie interne
// (messages_internes), superadmin, transferts, opérations Edge (création de
// comptes, reset mdp) — voir supabase/POWERSYNC-SETUP.md.
//
// Ce fichier ne doit importer AUCUN module lourd (@powersync/web/wa-sqlite) :
// il est chargé statiquement par data-supabase.js (donc dans les DEUX builds,
// Firebase et Supabase) pour ce simple test synchrone. Le reste de
// src/backend/powersync/ (client/connector/local-data, qui eux importent
// @powersync/web) n'est chargé qu'en `import()` dynamique, uniquement quand
// ce test est vrai — zéro coût de bundle pour le build Firebase (prod).
export const powerSyncConfigured = Boolean(String(import.meta.env.VITE_POWERSYNC_URL || "").trim());

export const TABLES_HORS_LIGNE = new Set([
  // Académique (vague 1)
  "eleves", "classes", "matieres", "enseignants",
  "emplois", "enseignements", "notes", "absences", "appreciations",
  // Comptabilité
  "recettes", "depenses", "versements", "bons", "personnel", "salaires", "tarifs",
  // Modules « document » (calendrier, examens, messages, fondation, journal)
  "evenements", "examens", "livrets", "honneurs",
  "messages", "annonces", "membres", "documents", "historique",
  // Référentiels (lecture) : comptes (AdminPanel), postes, ecoles (branding).
  "comptes", "postes", "ecoles",
]);

export function estCouvertHorsLigne(table) {
  return TABLES_HORS_LIGNE.has(table);
}

// Modules (pages) utilisables SANS réseau : tous ceux du personnel + le
// portail enseignant (leurs lectures passent par les tables miroir
// ci-dessus). Restent en ligne : superadmin_panel (pas de bucket — le
// superadmin est transversal) et portail_parent (vague ultérieure). Les
// ACTIONS intrinsèquement réseau (création de compte via Edge Function,
// reset mdp, sauvegarde des Paramètres de l'école) échouent proprement à la
// soumission avec leur message d'erreur habituel.
export const MODULES_HORS_LIGNE = new Set([
  "accueil", "historique", "admin_panel", "parametres", "compta",
  "primaire", "secondaire", "calendrier", "examens", "messages",
  "fondation", "portail_enseignant",
]);

export function moduleDisponibleHorsLigne(page) {
  return MODULES_HORS_LIGNE.has(page);
}

// Colonnes jsonb (Postgres) → stockées en TEXT côté SQLite local ; ce module
// est la SEULE frontière qui (dé)sérialise, pour que collection-map.js
// (transformRow/toRow) reste inchangé et identique en ligne/hors ligne.
const JSON_COLS = {
  eleves: ["extra"], classes: ["extra"], enseignants: ["extra"],
  matieres: ["extra"], emplois: ["extra"], enseignements: ["extra"],
  recettes: ["extra"], depenses: ["extra"], versements: ["extra"],
  bons: ["extra"], personnel: ["extra"], tarifs: ["extra"],
  salaires: ["details"],
  evenements: ["extra"], examens: ["extra"], livrets: ["extra"],
  honneurs: ["extra"], messages: ["extra"], annonces: ["extra"],
  membres: ["extra"], documents: ["extra"], historique: ["extra"],
  // sections = section_scolaire[] Postgres → JSON text côté SQLite.
  comptes: ["extra", "sections"],
  postes: ["permissions"],
  ecoles: ["extra", "role_settings", "legal"],
};

export function parseJsonCols(table, row) {
  const cols = JSON_COLS[table];
  if (!cols || !row) return row;
  const out = { ...row };
  for (const c of cols) {
    if (typeof out[c] === "string") {
      try { out[c] = JSON.parse(out[c]); } catch { /* laisse la chaîne telle quelle */ }
    }
  }
  return out;
}

export function stringifyJsonCols(table, row) {
  const cols = JSON_COLS[table];
  if (!cols) return row;
  const out = { ...row };
  for (const c of cols) {
    if (out[c] !== undefined && typeof out[c] !== "string") out[c] = JSON.stringify(out[c]);
  }
  return out;
}
