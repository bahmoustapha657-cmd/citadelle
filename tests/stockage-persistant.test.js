// Demande de stockage persistant (src/stockage-persistant.js) : les données
// hors ligne ne doivent plus pouvoir être effacées par le navigateur quand le
// disque se remplit. La demande ne doit jamais faire échouer l'app.
import test from "node:test";
import assert from "node:assert/strict";
import { demanderStockagePersistant, protegerDonneesLocales } from "../src/stockage-persistant.js";

const etat = { storage: undefined };
Object.defineProperty(globalThis.navigator, "storage", { configurable: true, get: () => etat.storage });

const faux = ({ deja = false, accorde = true, erreur = null } = {}) => {
  const appels = [];
  return {
    appels,
    async persisted() { appels.push("persisted"); if (erreur) throw erreur; return deja; },
    async persist() { appels.push("persist"); return accorde; },
  };
};

test("déjà persistant : aucune nouvelle demande", async () => {
  etat.storage = faux({ deja: true });
  assert.equal(await demanderStockagePersistant(), "deja");
  assert.deepEqual(etat.storage.appels, ["persisted"]);
});

test("accordé ou refusé par le navigateur", async () => {
  etat.storage = faux({ accorde: true });
  assert.equal(await demanderStockagePersistant(), "accorde");
  etat.storage = faux({ accorde: false });
  assert.equal(await demanderStockagePersistant(), "refuse");
});

test("navigateur sans l'API ou en erreur : rien ne casse", async () => {
  etat.storage = undefined;
  assert.equal(await demanderStockagePersistant(), "indisponible");
  etat.storage = { persisted: async () => false }; // persist() absent
  assert.equal(await demanderStockagePersistant(), "indisponible");
  etat.storage = faux({ erreur: new Error("SecurityError") });
  assert.equal(await demanderStockagePersistant(), "indisponible");
});

test("une seule demande par ouverture de l'app", async () => {
  etat.storage = faux({ accorde: true });
  const [a, b] = await Promise.all([protegerDonneesLocales(), protegerDonneesLocales()]);
  await protegerDonneesLocales();
  assert.equal(a, "accorde");
  assert.equal(b, "accorde");
  assert.deepEqual(etat.storage.appels, ["persisted", "persist"]);
});
