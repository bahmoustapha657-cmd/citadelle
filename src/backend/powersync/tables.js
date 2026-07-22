// ── Périmètre hors ligne (vague 1) ──────────────────────────────────────────
// Tables Supabase mises en miroir localement via PowerSync. Le reste (compta,
// portail parent, superadmin, transferts…) continue de passer directement
// par supabase-js — non couvert par ce chantier, voir FRONTEND-SUPABASE.md.
//
// Ce fichier ne doit importer AUCUN module lourd (@powersync/web/wa-sqlite) :
// il est chargé statiquement par data-supabase.js (donc dans les DEUX builds,
// Firebase et Supabase) pour ce simple test synchrone. Le reste de
// src/backend/powersync/ (client/connector/local-data, qui eux importent
// @powersync/web) n'est chargé qu'en `import()` dynamique, uniquement quand
// ce test est vrai — zéro coût de bundle pour le build Firebase (prod).
export const powerSyncConfigured = Boolean(String(import.meta.env.VITE_POWERSYNC_URL || "").trim());

export const TABLES_HORS_LIGNE = new Set([
  "eleves", "classes", "matieres", "enseignants",
  "emplois", "enseignements", "notes", "absences", "appreciations",
]);

export function estCouvertHorsLigne(table) {
  return TABLES_HORS_LIGNE.has(table);
}

// Modules (pages) utilisables SANS réseau : ceux dont les lectures se limitent
// aux tables miroir ci-dessus. Le personnel académique (Dir. Primaire /
// Secondaire) et le portail enseignant lisent élèves/notes/absences… tous
// synchronisés. Les autres (Comptes & Postes, Comptabilité, Paramètres,
// Calendrier, Examens, Messages…) tapent des tables non couvertes et doivent
// afficher un état « indisponible hors ligne » plutôt que d'enchaîner des
// requêtes réseau vouées à l'échec.
export const MODULES_HORS_LIGNE = new Set(["primaire", "secondaire", "portail_enseignant"]);

export function moduleDisponibleHorsLigne(page) {
  return MODULES_HORS_LIGNE.has(page);
}

// Colonnes jsonb (Postgres) → stockées en TEXT côté SQLite local ; ce module
// est la SEULE frontière qui (dé)sérialise, pour que collection-map.js
// (transformRow/toRow) reste inchangé et identique en ligne/hors ligne.
const JSON_COLS = {
  eleves: ["extra"], classes: ["extra"], enseignants: ["extra"],
  matieres: ["extra"], emplois: ["extra"], enseignements: ["extra"],
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
