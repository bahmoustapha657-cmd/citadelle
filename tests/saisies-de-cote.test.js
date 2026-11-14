// Saisies hors ligne mises de côté (powersync/saisies-de-cote.js) : quand un
// autre compte se connecte sur l'appareil, les saisies que le précédent n'a
// pas encore envoyées ne partent plus avec le miroir vidé. Elles attendent
// leur auteur, et repartent avec SA session, avant toute nouvelle saisie.
//
// Le test du connecteur demande les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/saisies-de-cote.test.js
// `npm test` le passe. Sans ce drapeau, seuls les tests sans mock s'exécutent.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import {
  compterSaisiesDeCote, entreeDeCote, mettreDeCote, renvoyerSaisiesDeCote, saisiesDeCote,
} from "../src/backend/powersync/saisies-de-cote.js";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const stock = new Map();
let stockagePlein = false;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (stock.has(k) ? stock.get(k) : null),
    setItem: (k, v) => {
      if (stockagePlein) throw new Error("QuotaExceededError");
      stock.set(k, String(v));
    },
    removeItem: (k) => stock.delete(k),
  },
});
const raz = () => { stock.clear(); stockagePlein = false; };

// Entrées telles que la file PowerSync les donne (CrudEntry) : des champs
// en plus (clientId, transactionId…) qui ne servent pas à l'envoi.
const crud = (id, op = "PUT", table = "paiements", extra = {}) => ({
  clientId: 7, transactionId: 3, op, table, id, opData: { montant: 1000 }, ...extra,
});

const passagere = (err) => err?.status === 0;
const coupure = () => Object.assign(new Error("Failed to fetch"), { status: 0 });

test("mettre de côté : au nom de l'auteur, dans l'ordre de la file, à la suite", () => {
  raz();
  assert.equal(mettreDeCote("comptable", [crud("p1"), crud("p2")]), true);
  assert.equal(mettreDeCote("comptable", [crud("p3", "PATCH", "eleves", { previousValues: { extra: "{}" } })]), true);
  assert.equal(mettreDeCote("directeur", [crud("d1")]), true);
  assert.deepEqual(saisiesDeCote("comptable").map((e) => e.id), ["p1", "p2", "p3"]);
  assert.equal(compterSaisiesDeCote("directeur"), 1);
  assert.equal(compterSaisiesDeCote("inconnu"), 0);
  assert.equal(compterSaisiesDeCote(null), 0);
  // Seul ce que l'envoi lit est gardé.
  assert.deepEqual(saisiesDeCote("comptable")[2], {
    op: "PATCH", table: "eleves", id: "p3", opData: { montant: 1000 }, previousValues: { extra: "{}" },
  });
  assert.deepEqual(entreeDeCote({ op: "DELETE", table: "notes", id: "n1" }), { op: "DELETE", table: "notes", id: "n1" });
});

test("mettre de côté : rien à garder = succès ; auteur inconnu ou stockage plein = échec", () => {
  raz();
  assert.equal(mettreDeCote(null, []), true);
  assert.equal(mettreDeCote("comptable", null), true);
  assert.equal(mettreDeCote(null, [crud("p1")]), false);
  stockagePlein = true;
  assert.equal(mettreDeCote("comptable", [crud("p1")]), false);
  stockagePlein = false;
  assert.equal(compterSaisiesDeCote("comptable"), 0);
});

test("renvoi : tout part dans l'ordre, puis plus rien n'est gardé", async () => {
  raz();
  mettreDeCote("comptable", [crud("p1"), crud("p2"), crud("p3")]);
  mettreDeCote("directeur", [crud("d1")]);
  const envoyees = [];
  const r = await renvoyerSaisiesDeCote("comptable", {
    envoyer: async (op) => { envoyees.push(op.id); }, estPassagere: passagere,
  });
  assert.deepEqual(envoyees, ["p1", "p2", "p3"]);
  assert.deepEqual(r, { envoyees: 3, refusees: 0, restantes: 0 });
  assert.equal(compterSaisiesDeCote("comptable"), 0);
  // Celles d'un autre compte ne bougent pas.
  assert.equal(compterSaisiesDeCote("directeur"), 1);
});

test("renvoi : une coupure arrête tout, la suite repart plus tard dans l'ordre", async () => {
  raz();
  mettreDeCote("comptable", [crud("p1"), crud("p2"), crud("p3")]);
  let reseau = true;
  const envoyees = [];
  const regles = {
    envoyer: async (op) => {
      if (op.id === "p2" && !reseau) throw coupure();
      envoyees.push(op.id);
    },
    estPassagere: passagere,
  };
  reseau = false;
  const r1 = await renvoyerSaisiesDeCote("comptable", regles);
  assert.deepEqual(r1, { envoyees: 1, refusees: 0, restantes: 2 });
  assert.deepEqual(saisiesDeCote("comptable").map((e) => e.id), ["p2", "p3"]);
  reseau = true;
  const r2 = await renvoyerSaisiesDeCote("comptable", regles);
  assert.deepEqual(r2, { envoyees: 2, refusees: 0, restantes: 0 });
  assert.deepEqual(envoyees, ["p1", "p2", "p3"]);
});

test("renvoi : un refus définitif est gardé puis abandonné, sans bloquer les suivantes", async () => {
  raz();
  mettreDeCote("comptable", [crud("p1"), crud("p2"), crud("p3")]);
  const refus = [];
  const r = await renvoyerSaisiesDeCote("comptable", {
    envoyer: async (op) => { if (op.id === "p2") throw Object.assign(new Error("RLS"), { status: 403 }); },
    estPassagere: passagere,
    surRefus: async (op, err) => { refus.push([op.id, err.message]); throw new Error("garde en panne"); },
  });
  assert.deepEqual(refus, [["p2", "RLS"]]);
  assert.deepEqual(r, { envoyees: 2, refusees: 1, restantes: 0 });
});

test("renvoi : deux renvois simultanés n'envoient jamais une saisie deux fois", async () => {
  raz();
  mettreDeCote("comptable", [crud("p1"), crud("p2")]);
  const envoyees = [];
  const regles = {
    envoyer: async (op) => { await new Promise((fin) => setTimeout(fin, 5)); envoyees.push(op.id); },
    estPassagere: passagere,
  };
  await Promise.all([renvoyerSaisiesDeCote("comptable", regles), renvoyerSaisiesDeCote("comptable", regles)]);
  assert.deepEqual(envoyees, ["p1", "p2"]);
});

test("connecteur : les saisies de côté partent d'abord, avec la session de leur auteur", { skip: ignore }, async (t) => {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  const appels = [];
  const lignes = [];
  let session = { access_token: "jeton", user: { id: "comptable" } };
  let reseauCoupe = false;
  mock.module("@powersync/web", { namedExports: { UpdateType: { PUT: "PUT", PATCH: "PATCH", DELETE: "DELETE" } } });
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => ({
        auth: { getSession: async () => ({ data: { session }, error: null }) },
        from: (table) => ({
          insert: async (r) => {
            if (reseauCoupe) return { error: { message: "Failed to fetch" }, status: 0 };
            appels.push(`insert:${table}:${r.id}`);
            return { error: null };
          },
          upsert: async (r) => { appels.push(`upsert:${table}:${r.id}`); lignes.push(r); return { error: null }; },
        }),
      }),
    },
  });
  mock.module(url("../src/backend/powersync/tables.js"), {
    // Colonnes jsonb en texte dans la file : re-parsées à l'envoi.
    namedExports: {
      parseJsonCols: (_t, r) => (r && typeof r.extra === "string" ? { ...r, extra: JSON.parse(r.extra) } : r),
      stringifyJsonCols: (_t, r) => r,
    },
  });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  const { SupabaseConnector, envoyerSaisiesDeCote } = await import("../src/backend/powersync/connector.js");
  const transaction = (ops) => {
    const tr = { crud: ops, fini: false, complete: async () => { tr.fini = true; } };
    return { getNextCrudTransaction: async () => tr, tr };
  };

  await t.test("ordre : d'abord les saisies de côté, puis la file", async () => {
    raz(); appels.length = 0;
    mettreDeCote("comptable", [crud("p1"), crud("e1", "PUT", "eleves", { opData: { extra: "{\"mois\":[\"oct\"]}" } })]);
    const base = transaction([crud("p2")]);
    await new SupabaseConnector("comptable").uploadData(base);
    assert.deepEqual(appels, ["insert:paiements:p1", "upsert:eleves:e1", "insert:paiements:p2"]);
    assert.equal(base.tr.fini, true);
    assert.equal(compterSaisiesDeCote("comptable"), 0);
  });

  await t.test("renvoi direct (client.js) : jsonb re-parsé, reste compté", async () => {
    raz(); appels.length = 0; lignes.length = 0;
    mettreDeCote("comptable", [crud("e1", "PUT", "eleves", { opData: { extra: "{\"mois\":[\"oct\"]}" } })]);
    assert.equal(await envoyerSaisiesDeCote("comptable", {}), 0);
    assert.deepEqual(appels, ["upsert:eleves:e1"]);
    assert.deepEqual(lignes[0], { id: "e1", extra: { mois: ["oct"] } });
    assert.equal(await envoyerSaisiesDeCote("personne", {}), 0);
  });

  await t.test("session d'un AUTRE compte : rien ne part, la file attend", async () => {
    raz(); appels.length = 0;
    session = { access_token: "jeton", user: { id: "directeur" } };
    mettreDeCote("comptable", [crud("p1")]);
    const base = transaction([crud("p2")]);
    await assert.rejects(new SupabaseConnector("comptable").uploadData(base));
    assert.deepEqual(appels, []);
    assert.equal(base.tr.fini, false);
    assert.equal(compterSaisiesDeCote("comptable"), 1);
    // Et le connecteur du directeur ne les envoie pas non plus.
    const autre = transaction([crud("d1")]);
    await new SupabaseConnector("directeur").uploadData(autre);
    assert.deepEqual(appels, ["insert:paiements:d1"]);
    assert.equal(compterSaisiesDeCote("comptable"), 1);
    session = { access_token: "jeton", user: { id: "comptable" } };
  });

  await t.test("coupure pendant le renvoi : rien de plus récent ne passe avant", async () => {
    raz(); appels.length = 0;
    mettreDeCote("comptable", [crud("p1")]);
    reseauCoupe = true;
    const base = transaction([crud("p2")]);
    await assert.rejects(new SupabaseConnector("comptable").uploadData(base));
    assert.equal(base.tr.fini, false);
    assert.equal(compterSaisiesDeCote("comptable"), 1);
    reseauCoupe = false;
    await new SupabaseConnector("comptable").uploadData(base);
    assert.deepEqual(appels, ["insert:paiements:p1", "insert:paiements:p2"]);
  });

  await t.test("sans saisie de côté : la file part comme avant", async () => {
    raz(); appels.length = 0;
    const base = transaction([crud("p9")]);
    await new SupabaseConnector("comptable").uploadData(base);
    assert.deepEqual(appels, ["insert:paiements:p9"]);
  });
});
