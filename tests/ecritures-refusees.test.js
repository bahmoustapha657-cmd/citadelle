// Chantier 4 : une écriture refusée par le serveur (RLS) ou sans effet
// (0 ligne) ne doit JAMAIS passer pour un succès.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENEMENT_ECRITURE_REFUSEE, EcritureSansEffet, exigerEffet, lireJournalRefus,
  messageRefus, signalerEcritureRefusee, verifierEffet,
} from "../src/backend/ecritures-refusees.js";
import { envoyerOperation } from "../src/backend/powersync/envoi-operation.js";

const stockageMemoire = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test("0 ligne touchée = EcritureSansEffet ; une erreur reste une erreur ; ≥ 1 ligne passe", () => {
  assert.throws(() => verifierEffet({ error: null, count: 0 }, "eleves", "modification"), EcritureSansEffet);
  assert.throws(() => verifierEffet({ error: { message: "boom" }, count: null }, "eleves", "modification"), /boom/);
  // Code et indice Postgres conservés : l'écran reconnaît un refus métier.
  assert.throws(
    () => verifierEffet({ error: { message: "refus", code: "P0001", hint: "eleve_avec_encaissements" } }, "eleves", "suppression"),
    (e) => e.code === "P0001" && e.hint === "eleve_avec_encaissements",
  );
  assert.doesNotThrow(() => verifierEffet({ error: null, count: 1 }, "eleves", "modification"));
});

test("en ligne : le refus est journalisé sur l'appareil et annoncé par un événement", () => {
  const stockage = stockageMemoire();
  const cible = new EventTarget();
  const recus = [];
  cible.addEventListener(EVENEMENT_ECRITURE_REFUSEE, (e) => recus.push(e.detail));

  assert.throws(
    () => exigerEffet({ error: null, count: 0 }, { table: "eleves", operation: "modification", id: "e1" }, { stockage, cible }),
    EcritureSansEffet,
  );
  assert.equal(recus.length, 1);
  assert.equal(recus[0].table, "eleves");
  assert.equal(recus[0].horsLigne, false);
  assert.equal(lireJournalRefus(stockage)[0].id, "e1");

  // Succès : ni événement ni journal.
  exigerEffet({ error: null, count: 1 }, { table: "eleves", operation: "modification" }, { stockage, cible });
  assert.equal(recus.length, 1);
});

test("le journal de l'appareil garde les 50 derniers refus, du plus récent au plus ancien", () => {
  const stockage = stockageMemoire();
  for (let i = 0; i < 60; i++) signalerEcritureRefusee({ table: "notes", operation: "PATCH", id: `n${i}` }, { stockage, cible: null });
  const journal = lireJournalRefus(stockage);
  assert.equal(journal.length, 50);
  assert.equal(journal[0].id, "n59");
});

test("message : singulier, pluriel, précision hors ligne", () => {
  assert.match(messageRefus(1, false), /Une modification n'a pas été enregistrée/);
  assert.match(messageRefus(3, true), /3 modifications n'ont pas été enregistrées.*hors ligne/);
});

// Faux client supabase-js : enregistre les appels, répond ce qu'on lui dit.
function fauxClient(reponses) {
  const appels = [];
  const chaine = (table, op, args) => {
    const r = { ...reponses[op] };
    const promesse = Promise.resolve(r);
    return Object.assign(promesse, { eq: (col, val) => { appels.push([op, table, args, col, val]); return promesse; } });
  };
  return {
    appels,
    from: (table) => ({
      insert: async (rec) => { appels.push(["insert", table, rec]); return { ...reponses.insert }; },
      upsert: async (rec) => { appels.push(["upsert", table, rec]); return { ...reponses.upsert }; },
      update: (patch, opts) => chaine(table, "update", [patch, opts]),
      delete: (opts) => chaine(table, "delete", [opts]),
    }),
  };
}

test("PowerSync : modification et suppression demandent le nombre de lignes, 0 = refus", async () => {
  const ok = fauxClient({ update: { error: null, count: 1 }, delete: { error: null, count: 1 } });
  await envoyerOperation(ok, { op: "PATCH", table: "eleves", id: "e1" }, { patch: { nom: "X" } });
  await envoyerOperation(ok, { op: "DELETE", table: "notes", id: "n1" });
  assert.deepEqual(ok.appels.map(([op, table, args]) => [op, table, args.at(-1)]), [
    ["update", "eleves", { count: "exact" }],
    ["delete", "notes", { count: "exact" }],
  ]);

  const refus = fauxClient({ update: { error: null, count: 0 }, delete: { error: null, count: 0 } });
  await assert.rejects(envoyerOperation(refus, { op: "PATCH", table: "eleves", id: "e1" }, { patch: {} }), EcritureSansEffet);
  await assert.rejects(envoyerOperation(refus, { op: "DELETE", table: "notes", id: "n1" }), EcritureSansEffet);
});

test("PowerSync : journal de caisse en ajout seul, renvoi d'une ligne déjà reçue = succès", async () => {
  const doublon = fauxClient({ insert: { error: { code: "23505", message: "duplicate key" } } });
  await envoyerOperation(doublon, { op: "PUT", table: "paiements", id: "p1" }, { record: { id: "p1" } });
  assert.equal(doublon.appels[0][0], "insert");
  const refus = fauxClient({ insert: { error: { code: "42501", message: "row-level security" } } });
  // supabase-js rejette un objet { code, message } (pas une Error).
  await assert.rejects(
    envoyerOperation(refus, { op: "PUT", table: "paiements", id: "p2" }, { record: { id: "p2" } }),
    (e) => /row-level security/.test(e.message),
  );
});
