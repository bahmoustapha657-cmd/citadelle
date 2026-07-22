// ── Accès générique au miroir local (lecture/écriture) ──────────────────────
// Contrepartie hors ligne des appels supabase-js de data-supabase.js : mêmes
// filtres (ecole_id/section/annee), mêmes formes de ligne (toRow/transformRow
// de collection-map.js restent la seule source de vérité pour le mapping
// camelCase ↔ snake_case). Les écritures ici passent par `db.execute`, que
// PowerSync met automatiquement en file pour upload (voir connector.js).
import { getPowerSync } from "./client";
import { parseJsonCols, stringifyJsonCols } from "./tables";

// Doit rester aligné sur ANNEE_TABLES (data-supabase.js).
const ANNEE_TABLES_LOCAL = new Set(["notes", "recettes", "depenses", "versements", "bons"]);

export async function lireLocal(table, { ecoleId, section, annee }) {
  const ps = getPowerSync();
  const conditions = ["ecole_id = ?"];
  const params = [ecoleId];
  if (section) { conditions.push("section = ?"); params.push(section); }
  if (annee && ANNEE_TABLES_LOCAL.has(table)) { conditions.push("annee = ?"); params.push(annee); }
  const sql = `SELECT * FROM ${table} WHERE ${conditions.join(" AND ")}`;
  const rows = await ps.getAll(sql, params);
  return rows.map((r) => parseJsonCols(table, r));
}

export async function insererLocal(table, row) {
  const ps = getPowerSync();
  const id = crypto.randomUUID();
  const complet = stringifyJsonCols(table, { ...row, id });
  const cols = Object.keys(complet);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  await ps.execute(sql, cols.map((c) => complet[c]));
  return { ...complet, extra: row.extra }; // renvoie la forme non stringifiée à l'appelant
}

export async function majLocal(table, id, row) {
  const ps = getPowerSync();
  const complet = stringifyJsonCols(table, row);
  const cols = Object.keys(complet);
  if (!cols.length) return;
  const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`;
  await ps.execute(sql, [...cols.map((c) => complet[c]), id]);
}

// Upsert avec id connu à l'avance (ex. saveNotes : items déjà pourvus de _id).
// Remplace la ligne entière si elle existe déjà — même sémantique que
// `.upsert()` côté supabase-js (colonnes non fournies → NULL).
export async function upsertLocal(table, id, row) {
  const ps = getPowerSync();
  const complet = stringifyJsonCols(table, { ...row, id });
  const cols = Object.keys(complet);
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  await ps.execute(sql, cols.map((c) => complet[c]));
  return { ...complet, extra: row.extra };
}

export async function supprimerLocal(table, id) {
  const ps = getPowerSync();
  await ps.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

// Lecture d'une seule ligne — utilisée pour le read-modify-write des colonnes
// jsonb (modifierChampDoc), identique en ligne/hors ligne.
export async function lireUneLocal(table, id) {
  const ps = getPowerSync();
  const row = await ps.getOptional(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return row ? parseJsonCols(table, row) : null;
}

// ── Lecteurs dédiés (tables sans colonne ecole_id ou à forme spéciale) ──────

// Fiche école par code (branding/plan/verrous) — miroir de chargerEcole.
export async function lireEcoleLocale(code) {
  const ps = getPowerSync();
  const row = await ps.getOptional("SELECT * FROM ecoles WHERE code = ?", [code]);
  return row ? parseJsonCols("ecoles", row) : null;
}

// Postes de l'école + nb de comptes rattachés — miroir de chargerPostes.
// (comptes n'est synchronisé que pour les porteurs d'admin_panel — les seuls
// à ouvrir ce panneau ; pour les autres le count vaut 0 sans conséquence.)
export async function lirePostesLocal(ecoleId) {
  const ps = getPowerSync();
  const rows = await ps.getAll(
    `SELECT p.*, (SELECT count(*) FROM comptes c WHERE c.poste_id = p.id) AS nb_comptes
       FROM postes p WHERE p.ecole_id = ?
       ORDER BY p.systeme DESC, p.label`,
    [ecoleId],
  );
  return rows.map((r) => parseJsonCols("postes", r));
}
