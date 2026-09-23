// Bout en bout, hors ligne : le VRAI chargerCollection (data-supabase.js) et la
// VRAIE lecture locale (local-data.js) sur un SQLite réel qui tient lieu du
// miroir PowerSync. Seuls sont simulés les modules liés au navigateur ou au
// réseau : le client PowerSync, le client Supabase, et tables.js (il lit
// import.meta.env, propre à Vite).
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/chargement-hors-ligne.test.js
// Sans ce drapeau (npm test), le test est ignoré ; filtres-lecture.test.js
// couvre la même logique sans mocks.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";

const sqlite = await import("node:sqlite").catch(() => null);
const ignore = typeof mock.module !== "function"
  ? "mocks de modules absents : lancer avec --experimental-test-module-mocks"
  : !sqlite && "node:sqlite indisponible sur cette version de Node";

const ECOLE = { code: "citadelle", id: "ec1" };
const ANNEE = "2025-2026";

async function monterMiroir() {
  const db = new sqlite.DatabaseSync(":memory:");
  for (const t of AppSchema.toJSON().tables) {
    db.exec(`CREATE TABLE ${t.name} (id TEXT PRIMARY KEY, ${t.columns.map((c) => c.name).join(", ")})`);
  }
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/backend/powersync/client.js"), {
    namedExports: {
      getPowerSync: () => ({
        getAll: async (sql, params = []) => db.prepare(sql).all(...params),
        getOptional: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
        execute: async (sql, params = []) => db.prepare(sql).run(...params),
      }),
    },
  });
  mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: {
      powerSyncConfigured: true,
      estCouvertHorsLigne: (table) => ["notes", "appreciations"].includes(table),
      // Ni notes ni appreciations n'ont de colonne jsonb : identité.
      parseJsonCols: (_table, ligne) => ligne,
      stringifyJsonCols: (_table, ligne) => ligne,
    },
  });
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => ({
        from: () => ({
          select: () => ({
            eq: (_col, code) => ({
              maybeSingle: async () => ({ data: code === ECOLE.code ? { id: ECOLE.id } : null }),
            }),
          }),
        }),
      }),
    },
  });
  // ecoleIdFromCode met l'uuid en cache dans localStorage.
  const stock = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
  });

  const inserer = (table, lignes) => {
    for (const l of lignes) {
      const cols = Object.keys(l);
      db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
        .run(...cols.map((c) => l[c]));
    }
  };
  let seq = 0;
  const note = (periode, extra = {}) => ({
    id: `n${++seq}`, ecole_id: ECOLE.id, section: "primaire", annee: ANNEE, eleve_id: "e1",
    matiere: "Maths", type: "Devoir", note: 12, periode, ...extra,
  });
  inserer("notes", [
    note("T1"), note("T1"), note("T1"), note("T2"), note("T2"), note("T3"),
    note("T1", { section: "college" }), note("T2", { annee: "2024-2025" }),
  ]);
  const app = (id, periode, annee) => ({
    id, ecole_id: ECOLE.id, section: "primaire", eleve_id: "e1", periode, annee, texte: "Bien",
  });
  inserer("appreciations", [app("a1", "T1", ANNEE), app("a2", "T2", ANNEE), app("a3", "T1", "2026-2027")]);

  return import("../src/backend/data-supabase.js");
}

test("module École hors ligne : les notes chargées en deux temps n'arrivent qu'une fois", { skip: ignore }, async (t) => {
  const { chargerCollection } = await monterMiroir();

  await t.test("notes : période affichée d'abord, le reste ensuite, sans recouvrement", async () => {
    // Les deux appels exacts de useFirestore quand periodePrioritaire = T1.
    const base = { annee: ANNEE };
    const [dabord, reste] = await Promise.all([
      chargerCollection(ECOLE.code, "notesPrimaire", { ...base, periode: "T1" }),
      chargerCollection(ECOLE.code, "notesPrimaire", { ...base, saufPeriode: "T1" }),
    ]);
    const liste = [...dabord.items, ...reste.items];
    const tout = (await chargerCollection(ECOLE.code, "notesPrimaire", base)).items;

    assert.equal(dabord.items.length, 3);
    assert.ok(dabord.items.every((n) => n.periode === "T1"));
    assert.equal(reste.items.length, 3);
    assert.ok(reste.items.every((n) => n.periode !== "T1"));
    assert.equal(new Set(liste.map((n) => n._id)).size, liste.length, "chaque note une seule fois");
    assert.deepEqual(liste.map((n) => n._id).sort(), tout.map((n) => n._id).sort());
    // Forme applicative (transformRow) intacte.
    assert.equal(liste[0].eleveId, "e1");
  });

  await t.test("appréciations : cloisonnées par année et par période", async () => {
    const lues = await chargerCollection(ECOLE.code, "appreciationsPrimaire", { annee: ANNEE });
    assert.deepEqual(lues.items.map((a) => a._id).sort(), ["a1", "a2"]);
    assert.ok(lues.items.every((a) => a.annee === ANNEE), "l'année remonte du miroir");
    const t1 = await chargerCollection(ECOLE.code, "appreciationsPrimaire", { annee: ANNEE, periode: "T1" });
    assert.deepEqual(t1.items.map((a) => a._id), ["a1"]);
  });
});
