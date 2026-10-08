import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { nomDeMigration } from "../scripts/nouvelle-migration.mjs";

const dossier = new URL("../supabase/migrations/", import.meta.url);
const migrations = readdirSync(dossier).filter((f) => f.endsWith(".sql")).sort();

test("migrations : noms <14 chiffres>_<nom>.sql, versions uniques", () => {
  assert.ok(migrations.length >= 1);
  for (const f of migrations) assert.match(f, /^\d{14}_[a-z0-9_]+\.sql$/, f);
  const versions = migrations.map((f) => f.slice(0, 14));
  assert.equal(new Set(versions).size, versions.length);
});

test("migrations : la baseline reste la première", () => {
  assert.equal(migrations[0], "20261008175200_baseline.sql");
});

test("plus de script SQL en vrac dans supabase/ (source unique : migrations/)", () => {
  const enVrac = readdirSync(new URL("../supabase/", import.meta.url)).filter((f) => f.endsWith(".sql"));
  assert.deepEqual(enVrac, [], "nouveau .sql dans supabase/ : en faire une migration (npm run migration:nouvelle)");
});

test("baseline : rôle PowerSync créé avant ses GRANT, Storage après les helpers", () => {
  const b = readFileSync(new URL("20261008175200_baseline.sql", dossier), "utf8");
  const role = b.indexOf("create role powersync_role");
  const premierGrant = b.indexOf('TO "powersync_role"');
  assert.ok(role > 0 && role < premierGrant);
  const helper = b.indexOf('FUNCTION "public"."auth_ecole_id"()');
  assert.ok(helper > 0 && helper < b.indexOf("create policy photos_insert"));
});

test("nomDeMigration : horodatage UTC + nom nettoyé", () => {
  const d = new Date("2026-10-09T07:05:03Z");
  assert.equal(nomDeMigration("Notes : coefficient élève", d), "20261009070503_notes_coefficient_eleve.sql");
  assert.throws(() => nomDeMigration("  ", d));
});
