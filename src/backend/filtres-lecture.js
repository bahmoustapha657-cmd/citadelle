// ── Filtres de tranche d'une lecture de collection ──────────────────────────
// chargerCollection ne lit qu'une TRANCHE d'une table : une école, parfois une
// section, une année. Ce module fixe ces règles pour les DEUX chemins de
// lecture de data-supabase.js :
//   • en ligne   : requête PostgREST ;
//   • hors ligne : SELECT sur le miroir SQLite de PowerSync (local-data.js).
// PowerSync est actif en production : c'est le chemin hors ligne qui sert
// TOUTES les tables couvertes. Tenues à la main de chaque côté, les deux
// versions avaient divergé — appréciations et salaires jamais filtrés par
// année hors ligne.
//
// Pur (aucun import) : testable sous Node.

// Tables filtrables par année (colonne `annee`).
export const ANNEE_TABLES = new Set([
  "notes", "recettes", "depenses", "versements", "bons", "paiements", "salaires", "appreciations",
]);

// Clause WHERE de la lecture locale, même sémantique que la requête en ligne :
//   annee → annee = ?  (.eq, tables d'ANNEE_TABLES)
export function clauseLectureLocale(table, { ecoleId, section, annee } = {}) {
  const conditions = ["ecole_id = ?"];
  const params = [ecoleId];
  if (section) { conditions.push("section = ?"); params.push(section); }
  if (annee && ANNEE_TABLES.has(table)) { conditions.push("annee = ?"); params.push(annee); }
  return { where: conditions.join(" AND "), params };
}
