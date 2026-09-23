// ── Filtres de tranche d'une lecture de collection ──────────────────────────
// chargerCollection ne lit qu'une TRANCHE d'une table : une école, parfois une
// section, une année, une période. Ce module fixe ces règles pour les DEUX
// chemins de lecture de data-supabase.js :
//   • en ligne   : requête PostgREST ;
//   • hors ligne : SELECT sur le miroir SQLite de PowerSync (local-data.js).
// PowerSync est actif en production : c'est le chemin hors ligne qui sert
// TOUTES les tables couvertes. Tenues à la main de chaque côté, les deux
// versions avaient divergé — période ignorée hors ligne (le chargement des
// notes en deux temps ramenait chaque note deux fois), appréciations et
// salaires jamais filtrés par année.
//
// Pur (aucun import) : testable sous Node.

// Tables filtrables par année (colonne `annee`).
export const ANNEE_TABLES = new Set([
  "notes", "recettes", "depenses", "versements", "bons", "paiements", "salaires", "appreciations",
]);

// Tables portant une colonne `periode` (T1/S1/M1…), filtrable au chargement.
export const PERIODE_TABLES = new Set(["notes", "appreciations"]);

// Clause WHERE de la lecture locale, même sémantique que la requête en ligne :
//   annee       → annee = ?     (.eq,  tables d'ANNEE_TABLES)
//   periode     → periode = ?   (.eq,  tables de PERIODE_TABLES)
//   saufPeriode → periode <> ?  (.neq, ignoré si `periode` est fourni)
// Écrite en SQL plutôt qu'en filtre JS : la comparaison se fait comme côté
// serveur, l'index local (ecole_id, section, annee, periode) des notes sert,
// et seule la tranche utile traverse le worker SQLite.
export function clauseLectureLocale(table, { ecoleId, section, annee, periode, saufPeriode } = {}) {
  const conditions = ["ecole_id = ?"];
  const params = [ecoleId];
  if (section) { conditions.push("section = ?"); params.push(section); }
  if (annee && ANNEE_TABLES.has(table)) { conditions.push("annee = ?"); params.push(annee); }
  if (PERIODE_TABLES.has(table)) {
    if (periode) { conditions.push("periode = ?"); params.push(periode); }
    else if (saufPeriode) { conditions.push("periode <> ?"); params.push(saufPeriode); }
  }
  return { where: conditions.join(" AND "), params };
}
