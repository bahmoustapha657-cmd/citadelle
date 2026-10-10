// Chantier 4 : une écriture refusée par le serveur (RLS) ou sans effet
// (0 ligne) ne doit JAMAIS passer pour un succès.
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENEMENT_ECRITURE_REFUSEE, EcritureSansEffet, exigerEffet, lireJournalRefus,
  messageRefus, signalerEcritureRefusee, verifierEffet,
} from "../src/backend/ecritures-refusees.js";
import { envoyerOperation, estErreurPassagere } from "../src/backend/powersync/envoi-operation.js";

const stockageMemoire = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
};

test("0 ligne touchée = EcritureSansEffet ; une erreur reste une erreur ; ≥ 1 ligne passe", () => {
  assert.throws(() => verifierEffet({ error: null, count: 0 }, "eleves", "modification"), EcritureSansEffet);
  assert.throws(() => verifierEffet({ error: { message: "boom" }, count: null }, "eleves", "modification"), /boom/);
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

test("PowerSync : un incident passager garde l'écriture en file, un refus l'abandonne", async () => {
  // supabase-js : requête jamais arrivée → statut 0, quel que soit le
  // navigateur (« Failed to fetch » sous Chrome, « Load failed » sous Safari).
  const coupure = fauxClient({ insert: { error: { message: "TypeError: Load failed", code: "" }, status: 0 } });
  const e = await envoyerOperation(coupure, { op: "PUT", table: "paiements", id: "p3" }, { record: { id: "p3" } }).catch((x) => x);
  assert.equal(e.status, 0);
  assert.equal(estErreurPassagere(e), true);
  // Passerelle, surcharge, délai : on réessaie plus tard.
  for (const status of [408, 429, 502, 503, 504, 522]) {
    assert.equal(estErreurPassagere({ message: "Service Unavailable", status }), true, String(status));
  }
  // Sans réseau, tout échec attend le retour du réseau.
  assert.equal(estErreurPassagere({ message: "permission denied", status: 403 }, { enLigne: false }), true);

  // Refus définitifs : abandonnés (et signalés par le connecteur).
  const refus = fauxClient({ upsert: { error: { message: "new row violates row-level security policy", code: "42501" }, status: 403 } });
  const r = await envoyerOperation(refus, { op: "PUT", table: "eleves", id: "e2" }, { record: { id: "e2" } }).catch((x) => x);
  assert.equal(r.code, "42501");
  assert.equal(estErreurPassagere(r), false);
  assert.equal(estErreurPassagere({ message: "violates foreign key constraint", status: 409, code: "23503" }), false);
  // 500 : une erreur interne peut se reproduire à l'identique et bloquerait la file.
  assert.equal(estErreurPassagere({ message: "internal error", status: 500 }), false);
  // Les messages réseau sans statut restent reconnus.
  assert.equal(estErreurPassagere({ message: "Failed to fetch" }), true);

  // Modification en échec : le statut de la réponse est gardé, lui aussi.
  const patch = fauxClient({ update: { error: { message: "upstream request timeout" }, status: 504, count: null } });
  const p = await envoyerOperation(patch, { op: "PATCH", table: "eleves", id: "e1" }, { patch: {} }).catch((x) => x);
  assert.equal(p.status, 504);
  assert.equal(estErreurPassagere(p), true);
});
