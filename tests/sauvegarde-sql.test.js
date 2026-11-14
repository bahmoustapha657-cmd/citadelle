// Outils purs de la sauvegarde complète et du remontage
// (supabase/sauvegarde-sql.mjs) : ce qui décide si une copie est complète et
// si la base remontée lui est identique.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SQL_TABLES_A_VIDER, TABLES_NON_COPIEES, compterLignesCopy, decouperUrl, derniereSauvegardeComplete,
  ecartsComptes, lireEnv, preambuleRemontage,
} from "../supabase/sauvegarde-sql.mjs";

test("adresse de la base : mot de passe mis à part, jamais dans la ligne de commande", () => {
  const { url, mdp } = decouperUrl("postgresql://postgres.abc:p%40ss%3Aw0rd@aws-0-eu.pooler.supabase.com:5432/postgres");
  assert.equal(mdp, "p@ss:w0rd");
  assert.equal(url, "postgresql://postgres.abc@aws-0-eu.pooler.supabase.com:5432/postgres");
  assert.ok(!url.includes("w0rd"));
  assert.throws(() => decouperUrl("https://exemple.com"), /Postgres/);
  assert.throws(() => decouperUrl(""));
});

test("lignes de chaque bloc COPY d'un dump pg_dump (fins de ligne Windows comprises)", () => {
  const dump = [
    "SET statement_timeout = 0;",
    'COPY "auth"."users" ("id", "email", "encrypted_password") FROM stdin;',
    "u1\ta@x\t$2a$10$hash",
    "u2\tb@x\t$2a$10$hash",
    "\\.",
    "",
    'COPY "public"."eleves" ("id", "nom") FROM stdin;',
    "\\.",
    'COPY "public"."notes" ("id", "note") FROM stdin;\r',
    "n1\t12\r",
    "n2\t\\N\r",
    "n3\t15\r",
    "\\.\r",
    "SELECT pg_catalog.setval('x', 1, true);",
  ].join("\n");
  assert.deepEqual(compterLignesCopy(dump), { "auth.users": 2, "public.eleves": 0, "public.notes": 3 });
});

test("remontage : tables vidées puis déclencheurs suspendus, dans la transaction", () => {
  assert.match(SQL_TABLES_A_VIDER, /'public', 'auth', 'storage'/);
  for (const t of TABLES_NON_COPIEES) assert.ok(SQL_TABLES_A_VIDER.includes(`'${t}'`), t);
  const p = preambuleRemontage('"public"."eleves", "auth"."users"');
  assert.match(p, /^SET session_replication_role = replica;/);
  assert.match(p, /TRUNCATE "public"\."eleves", "auth"\."users" CASCADE;/);
  assert.doesNotMatch(preambuleRemontage(""), /TRUNCATE/);
});

test("clés de la pile locale (supabase status -o env)", () => {
  const env = lireEnv('API_URL="http://127.0.0.1:54321"\r\nANON_KEY="eyJ"\nJWT_SECRET=secret\nbruit\n');
  assert.deepEqual(env, { API_URL: "http://127.0.0.1:54321", ANON_KEY: "eyJ", JWT_SECRET: "secret" });
});

test("écarts entre la copie et la base remontée", () => {
  assert.deepEqual(ecartsComptes({ "public.eleves": 3, "auth.users": 2 }, { "public.eleves": 3, "auth.users": 2 }), []);
  assert.deepEqual(ecartsComptes({ "public.eleves": 3, "public.notes": 1 }, { "public.eleves": 2 }), [
    { table: "public.eleves", attendu: 3, trouve: 2 },
    { table: "public.notes", attendu: 1, trouve: 0 },
  ]);
});

test("dernière sauvegarde COMPLÈTE : la plus récente qui a la copie de la base", (t) => {
  const dossier = mkdtempSync(join(tmpdir(), "sauvegardes-"));
  t.after(() => rmSync(dossier, { recursive: true, force: true }));
  const creer = (nom, manifeste, avecCopie) => {
    mkdirSync(join(dossier, nom, "base"), { recursive: true });
    writeFileSync(join(dossier, nom, "_manifest.json"), JSON.stringify(manifeste));
    if (avecCopie) writeFileSync(join(dossier, nom, "base", "donnees.sql"), "");
  };
  assert.equal(derniereSauvegardeComplete(join(dossier, "absent")), null);
  creer("backup-2026-11-10-1300", { complet: true, base: { ok: true } }, true);
  creer("backup-2026-11-11-1300", { complet: true, base: { absente: "pas de dbUrl" } }, false);
  creer("backup-2026-11-12-1300", { complet: true, base: { ok: true } }, false);
  mkdirSync(join(dossier, "backup-2026-11-13-1300"));
  assert.equal(derniereSauvegardeComplete(dossier), join(dossier, "backup-2026-11-10-1300"));
  creer("backup-2026-11-14-1300", { complet: true, base: { ok: true } }, true);
  assert.equal(derniereSauvegardeComplete(dossier), join(dossier, "backup-2026-11-14-1300"));
});
