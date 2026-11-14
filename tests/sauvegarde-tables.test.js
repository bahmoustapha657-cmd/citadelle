// Sauvegarde quotidienne (supabase/backup-donnees.mjs) : chaque table créée
// par les migrations doit être sauvegardée, ou écartée avec sa raison. La
// liste écrite à la main avait dérivé : dix tables (paiements Mobile Money,
// présences du personnel, transferts…) manquaient depuis leur création.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { EXCLUES, TABLES, TRI } from "../supabase/sauvegarde-tables.mjs";

const dossier = new URL("../supabase/migrations/", import.meta.url);
const sql = readdirSync(dossier).filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(new URL(f, dossier), "utf8")).join("\n");

const noms = (motif) => new Set([...sql.matchAll(motif)].map((m) => m[1].toLowerCase()));
const tablesSql = noms(/create table (?:if not exists )?"?public"?\."?([a-z_0-9]+)/gi);
const vuesSql = noms(/create (?:or replace )?view "?public"?\."?([a-z_0-9]+)/gi);
// Tables supprimées par une migration plus récente : plus rien à sauvegarder.
const supprimees = noms(/drop table (?:if exists )?"?public"?\."?([a-z_0-9]+)/gi);

test("migrations lues : la base compte bien des dizaines de tables", () => {
  assert.ok(tablesSql.size > 40, `${tablesSql.size} tables trouvées`);
  assert.ok(tablesSql.has("eleves") && tablesSql.has("paiements"));
});

test("chaque table des migrations est sauvegardée ou écartée avec sa raison", () => {
  const oubliees = [...tablesSql]
    .filter((t) => !supprimees.has(t) && !TABLES.includes(t) && !(t in EXCLUES));
  assert.deepEqual(oubliees, [], "à ajouter à TABLES (ou à EXCLUES, avec la raison) dans supabase/sauvegarde-tables.mjs");
});

test("la sauvegarde ne vise que des tables ou vues qui existent, sans doublon", () => {
  const inconnues = TABLES.filter((t) => !tablesSql.has(t) && !vuesSql.has(t));
  assert.deepEqual(inconnues, []);
  assert.equal(new Set(TABLES).size, TABLES.length);
  for (const t of Object.keys(EXCLUES)) {
    assert.ok(!TABLES.includes(t), `${t} à la fois sauvegardée et écartée`);
    assert.ok(String(EXCLUES[t]).length > 5, `${t} : raison de l'exclusion manquante`);
  }
});

test("tri de pagination : seulement des tables sauvegardées, colonnes en liste", () => {
  for (const [t, colonnes] of Object.entries(TRI)) {
    assert.ok(TABLES.includes(t), `${t} : tri d'une table non sauvegardée`);
    assert.ok(Array.isArray(colonnes) && colonnes.length > 0, `${t} : colonnes de tri`);
  }
});
