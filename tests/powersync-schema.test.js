// Miroir hors ligne (PowerSync) : chaque colonne que l'app écrit doit exister
// dans le schéma client. Une vue PowerSync n'expose QUE les colonnes déclarées
// dans src/backend/powersync/schema.js ; une colonne oubliée fait échouer
// l'écriture locale (« table appreciations has no column named annee »), et
// PowerSync est actif en production. C'est ainsi que la colonne `annee`,
// ajoutée le 2026-08-12 aux appréciations et aux salaires côté Postgres et dans
// collection-map.js mais pas dans le schéma client, a bloqué toute écriture de
// ces deux tables.
import test from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";
import { colonnesEcrites, ecritureSupportee } from "../src/backend/collection-map.js";

test("toute colonne écrite par l'app existe dans le schéma du miroir local", () => {
  const verifiees = [];
  const manquantes = [];
  for (const t of AppSchema.toJSON().tables) {
    // ecoles, comptes, postes : lus hors ligne, écrits en ligne seulement.
    if (!ecritureSupportee(t.name)) continue;
    verifiees.push(t.name);
    const locales = new Set(t.columns.map((c) => c.name));
    for (const col of ["ecole_id", ...colonnesEcrites(t.name)]) {
      if (!locales.has(col)) manquantes.push(`${t.name}.${col}`);
    }
  }
  assert.deepEqual(manquantes, []);
  // Garde contre un test vide : les tables sensibles sont bien passées au crible.
  for (const t of ["notes", "appreciations", "salaires"]) assert.ok(verifiees.includes(t), t);
});

test("colonnesEcrites suit toRow : clés ignorées exclues, jsonb inclus", () => {
  assert.ok(colonnesEcrites("appreciations").includes("annee"));
  // `section` figure dans COLUMN_DEFS.salaires mais toRow ne l'écrit jamais.
  assert.ok(!colonnesEcrites("salaires").includes("section"));
  assert.ok(colonnesEcrites("salaires").includes("details"));
  assert.deepEqual(colonnesEcrites("table_inconnue"), []);
});
