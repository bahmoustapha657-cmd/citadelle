// File de synchro hors-ligne (étape B). localStorage simulé en mémoire.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { enqueue, queueCount, getQueue, processQueue } = await import("../src/components/portail-enseignant/notes-sync-queue.js");

const OWNER = "ens-A";
const reset = () => store.clear();

test("enqueue + queueCount : compte les notes de tous les lots", () => {
  reset();
  assert.equal(enqueue(OWNER, [{ a: 1 }, { b: 2 }]), 2);
  assert.equal(enqueue(OWNER, [{ c: 3 }]), 3);
  assert.equal(queueCount(OWNER), 3);
  assert.equal(getQueue(OWNER).length, 2); // 2 lots
});

test("files isolées par enseignant", () => {
  reset();
  enqueue("ens-A", [{ a: 1 }]);
  enqueue("ens-B", [{ b: 1 }, { c: 1 }]);
  assert.equal(queueCount("ens-A"), 1);
  assert.equal(queueCount("ens-B"), 2);
});

test("processQueue : succès → lots retirés", async () => {
  reset();
  enqueue(OWNER, [{ a: 1 }]);
  enqueue(OWNER, [{ b: 1 }]);
  const r = await processQueue(OWNER, async () => ({ ok: true }));
  assert.equal(r.saved, 2);
  assert.equal(r.remaining, 0);
  assert.equal(queueCount(OWNER), 0);
});

test("processQueue : erreur réseau → on s'arrête, la file est conservée", async () => {
  reset();
  enqueue(OWNER, [{ a: 1 }]);
  enqueue(OWNER, [{ b: 1 }]);
  const r = await processQueue(OWNER, async () => { throw new Error("offline"); });
  assert.equal(r.saved, 0);
  assert.equal(r.remaining, 2); // rien retiré, sera rejoué
});

test("processQueue : 1er lot OK puis coupure → seul le 1er est retiré", async () => {
  reset();
  enqueue(OWNER, [{ a: 1 }]);
  enqueue(OWNER, [{ b: 1 }]);
  let appels = 0;
  const r = await processQueue(OWNER, async () => {
    appels += 1;
    if (appels === 1) return { ok: true };
    throw new Error("offline");
  });
  assert.equal(r.saved, 1);
  assert.equal(r.remaining, 1);
});

test("processQueue : rejet serveur (ok=false) → lot retiré + compté en échec", async () => {
  reset();
  enqueue(OWNER, [{ a: 1 }, { b: 1 }]);
  const r = await processQueue(OWNER, async () => ({ ok: false }));
  assert.equal(r.failed, 2);
  assert.equal(r.remaining, 0); // pas de blocage infini
});
