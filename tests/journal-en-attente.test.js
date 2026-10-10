// Journal de caisse : une ligne que l'écriture refuse est gardée sur
// l'appareil puis renvoyée, sans jamais créer de doublon (cf.
// journal-en-attente.js). Constat du 2026-10-09 : 923 encaissements payés sur
// la fiche élève sans aucune ligne au journal.
//
// La seconde partie utilise les mocks de modules du test runner (le VRAI
// ajouterDoc, sur un SQLite réel qui tient lieu du miroir PowerSync) :
//   node --import tsx --experimental-test-module-mocks --test tests/journal-en-attente.test.js
// `npm test` le passe.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";
import {
  cleAttente, inscrireAuJournal, lireAttente, mettreEnAttente, renvoyerAttente,
} from "../src/components/comptabilite/journal-en-attente.js";

function stockageMemoire() {
  const m = new Map();
  return {
    m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const ecriture = (mois, montant = 100000) => ({
  annee: "2026-2027", type: "mensualite", statut: "encaisse", eleveId: "e1", eleveNom: "BAH Mariama",
  classe: "3ème Année B", mois, libelle: mois, montant, date: "2026-10-08", auteur: "Comptable",
});

test("une ligne écrite passe directement, avec un id fixé à la saisie", async () => {
  const stockage = stockageMemoire();
  const recues = [];
  const r = await inscrireAuJournal("ffd", async (l) => { recues.push(l); return { _id: l._id }; }, ecriture("Oct"), stockage);
  assert.equal(r.enAttente, false);
  assert.match(recues[0]._id, /^[0-9a-f-]{36}$/);
  assert.equal(recues[0].montant, 100000);
  assert.deepEqual(lireAttente("ffd", stockage), []);
});

test("une ligne refusée est gardée sur l'appareil, puis renvoyée avec le même id", async () => {
  const stockage = stockageMemoire();
  const avant = Date.now();
  const r = await inscrireAuJournal("ffd", async () => { throw new Error("no such table: paiements"); }, ecriture("Oct"), stockage);
  assert.equal(r.enAttente, true);
  assert.match(r.erreur.message, /no such table/);
  const [gardee] = lireAttente("ffd", stockage);
  assert.equal(gardee.mois, "Oct");
  assert.ok(gardee.createdAt >= avant, "date du geste conservée");
  // Rangée par école : une autre école de l'appareil n'en voit rien.
  assert.deepEqual(lireAttente("citadelle", stockage), []);

  const recues = [];
  const bilan = await renvoyerAttente("ffd", async (l) => { recues.push(l); }, stockage);
  assert.deepEqual(bilan, { envoyees: 1, restantes: 0 });
  assert.equal(recues[0]._id, gardee._id);
  assert.equal(recues[0].createdAt, gardee.createdAt);
  assert.equal(stockage.m.has(cleAttente("ffd")), false);
});

test("renvoi : dans l'ordre de saisie ; une ligne qui échoue encore reste, les suivantes partent", async () => {
  const stockage = stockageMemoire();
  for (const mois of ["Oct", "Nov", "Déc"]) mettreEnAttente("ffd", { ...ecriture(mois), _id: `id-${mois}` }, stockage);
  // Remise en attente d'une ligne déjà gardée : pas de doublon dans la file.
  mettreEnAttente("ffd", { ...ecriture("Oct"), _id: "id-Oct" }, stockage);
  assert.equal(lireAttente("ffd", stockage).length, 3);

  const vues = [];
  const bilan = await renvoyerAttente("ffd", async (l) => {
    vues.push(l.mois);
    if (l.mois === "Nov") throw new Error("Failed to fetch");
  }, stockage);
  assert.deepEqual(vues, ["Oct", "Nov", "Déc"]);
  assert.deepEqual(bilan, { envoyees: 2, restantes: 1 });
  assert.deepEqual(lireAttente("ffd", stockage).map((l) => l._id), ["id-Nov"]);
});

test("deux renvois simultanés n'envoient chaque ligne qu'une fois", async () => {
  const stockage = stockageMemoire();
  mettreEnAttente("ffd", { ...ecriture("Oct"), _id: "id-Oct" }, stockage);
  let envois = 0;
  const ajouter = async () => { envois += 1; await new Promise((ok) => setTimeout(ok, 10)); };
  const [a, b] = await Promise.all([renvoyerAttente("ffd", ajouter, stockage), renvoyerAttente("ffd", ajouter, stockage)]);
  assert.equal(envois, 1);
  assert.deepEqual(a, b);
});

test("stockage illisible ou indisponible : rien ne casse", async () => {
  const casse = { getItem: () => "{pas du json", setItem: () => { throw new Error("quota"); }, removeItem: () => {} };
  assert.deepEqual(lireAttente("ffd", casse), []);
  const r = await inscrireAuJournal("ffd", async () => { throw new Error("hors ligne"); }, ecriture("Oct"), casse);
  assert.equal(r.enAttente, true);
});

// ── Le VRAI ajouterDoc : id fixé par l'appelant, renvoi sans doublon ────────
const sqlite = await import("node:sqlite").catch(() => null);
const ignore = typeof mock.module !== "function"
  ? "mocks de modules absents : lancer avec --experimental-test-module-mocks"
  : !sqlite && "node:sqlite indisponible sur cette version de Node";

test("ajouterDoc (journal) : l'id et la date du geste sont gardés ; un renvoi retombe sur la même ligne", { skip: ignore }, async () => {
  const db = new sqlite.DatabaseSync(":memory:");
  for (const t of AppSchema.toJSON().tables) {
    db.exec(`CREATE TABLE ${t.name} (id TEXT PRIMARY KEY, ${t.columns.map((c) => c.name).join(", ")})`);
  }
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  let horsLigne = true;
  const insertions = [];
  let reponseInsert = { data: null, error: null };
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
      estCouvertHorsLigne: (table) => horsLigne && table === "paiements",
      parseJsonCols: (_t, l) => ({ ...l, extra: typeof l.extra === "string" ? JSON.parse(l.extra) : l.extra }),
      stringifyJsonCols: (_t, l) => ({ ...l, ...(l.extra && typeof l.extra !== "string" ? { extra: JSON.stringify(l.extra) } : {}) }),
    },
  });
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => ({
        from: (table) => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "ecoles" ? { id: "ec1" } : null }) }) }),
          insert: (row) => {
            insertions.push(row);
            return { select: () => ({ single: async () => reponseInsert }) };
          },
        }),
      }),
    },
  });
  const stock = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
  });
  const { ajouterDoc } = await import("../src/backend/data-supabase.js");

  // Hors ligne (miroir local) : la ligne garde l'id et la date fixés.
  const ligne = { ...ecriture("Oct"), _id: "11111111-1111-4111-8111-111111111111", createdAt: Date.parse("2026-10-08T16:46:23Z") };
  const creee = await ajouterDoc("ffd", "paiements", ligne);
  assert.equal(creee._id, ligne._id);
  // Renvoi de la même ligne (l'écran avait cru à un échec) : aucun doublon.
  const renvoyee = await ajouterDoc("ffd", "paiements", ligne);
  assert.equal(renvoyee._id, ligne._id);
  const lignes = db.prepare("SELECT * FROM paiements").all();
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].created_at, "2026-10-08T16:46:23.000Z");
  assert.equal(lignes[0].eleve_id, "e1");
  // Sans id fixé (autres écritures), rien ne change : id tiré au hasard.
  await ajouterDoc("ffd", "paiements", ecriture("Nov"));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM paiements").get().n, 2);

  // En ligne : l'id part avec la ligne ; « déjà présente » (23505) = succès.
  horsLigne = false;
  reponseInsert = { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
  const doublon = await ajouterDoc("ffd", "paiements", ligne);
  assert.equal(doublon._id, ligne._id);
  assert.equal(insertions.at(-1).id, ligne._id);
  assert.equal(insertions.at(-1).created_at, "2026-10-08T16:46:23.000Z");
  // Un vrai refus reste une erreur (la ligne sera gardée sur l'appareil).
  reponseInsert = { data: null, error: { code: "42501", message: "new row violates row-level security policy" } };
  await assert.rejects(ajouterDoc("ffd", "paiements", ligne), /row-level security/);
});
