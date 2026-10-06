// Journal des encaissements hors ligne : la ligne de caisse s'écrit dans le
// miroir local (horodatée à la saisie) puis remonte en INSERT — jamais en
// upsert, la RLS du journal n'accordant que l'ajout.
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/journal-hors-ligne.test.js
// Sans ce drapeau (npm test), seuls les tests sans mock s'exécutent.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";
import { colonnesEcrites } from "../src/backend/collection-map.js";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";
const url = (chemin) => new URL(chemin, import.meta.url).href;
const mocks = [];
const liberer = () => { while (mocks.length) mocks.pop().restore(); };

test("le miroir local porte toutes les colonnes du journal, et sa date de création", () => {
  const table = AppSchema.toJSON().tables.find((t) => t.name === "paiements");
  assert.ok(table, "paiements absent du schéma local");
  const locales = new Set(table.columns.map((c) => c.name));
  for (const col of ["ecole_id", "created_at", ...colonnesEcrites("paiements")]) assert.ok(locales.has(col), col);
});

test("connecteur : le journal remonte en INSERT, une ligne déjà reçue n'est pas une erreur", { skip: ignore }, async () => {
  const appels = [];
  let reponseInsert = { error: null };
  mocks.push(mock.module("@powersync/web", { namedExports: { UpdateType: { PUT: "PUT", PATCH: "PATCH", DELETE: "DELETE" } } }));
  mocks.push(mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => ({
        from: (table) => ({
          insert: async (r) => { appels.push(["insert", table, r]); return reponseInsert; },
          upsert: async (r) => { appels.push(["upsert", table, r]); return { error: null }; },
        }),
      }),
    },
  }));
  mocks.push(mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: { parseJsonCols: (_t, r) => r },
  }));
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  const { SupabaseConnector } = await import("../src/backend/powersync/connector.js");
  const connecteur = new SupabaseConnector();
  const transaction = (crud) => {
    const t = { crud, fini: false, complete: async () => { t.fini = true; } };
    return { getNextCrudTransaction: async () => t, t };
  };

  const a = transaction([
    { op: "PUT", table: "paiements", id: "p1", opData: { montant: 150000 } },
    { op: "PUT", table: "eleves", id: "e1", opData: { nom: "X" } },
  ]);
  await connecteur.uploadData(a);
  assert.deepEqual(appels.map(([op, table]) => `${op}:${table}`), ["insert:paiements", "upsert:eleves"]);
  assert.equal(appels[0][2].id, "p1");
  assert.equal(a.t.fini, true);

  // Renvoi d'une ligne que le serveur avait déjà reçue : succès silencieux.
  reponseInsert = { error: { code: "23505", message: "duplicate key value" } };
  const b = transaction([{ op: "PUT", table: "paiements", id: "p1", opData: {} }]);
  await connecteur.uploadData(b);
  assert.equal(b.t.fini, true);

  // Coupure réseau : la transaction reste en file pour être rejouée.
  reponseInsert = { error: { message: "Failed to fetch" } };
  const c = transaction([{ op: "PUT", table: "paiements", id: "p2", opData: {} }]);
  await assert.rejects(connecteur.uploadData(c));
  assert.equal(c.t.fini, false);
  liberer();
});

test("insertion locale : le journal est horodaté à la saisie", { skip: ignore }, async () => {
  const executes = [];
  mocks.push(mock.module(url("../src/backend/powersync/client.js"), {
    namedExports: { getPowerSync: () => ({ execute: async (sql, params) => executes.push({ sql, params }) }) },
  }));
  mocks.push(mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: { parseJsonCols: (_t, r) => r, stringifyJsonCols: (_t, r) => r },
  }));
  mocks.push(mock.module(url("../src/backend/filtres-lecture.js"), { namedExports: { clauseLectureLocale: () => ({}) } }));
  const { insererLocal } = await import("../src/backend/powersync/local-data.js");

  const avant = Date.now();
  const ligne = await insererLocal("paiements", { ecole_id: "ec1", montant: 150000 });
  assert.ok(Date.parse(ligne.created_at) >= avant);
  assert.match(executes[0].sql, /created_at/);
  // Les autres tables ne reçoivent rien de plus.
  const note = await insererLocal("notes", { ecole_id: "ec1", note: 12 });
  assert.equal("created_at" in note, false);
  liberer();
});
