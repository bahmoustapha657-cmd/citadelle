// Miroir hors ligne gardé d'une session à l'autre (powersync/client.js) : le
// même compte qui revient ne re-télécharge pas toute l'école ; un autre
// compte trouve un miroir vidé. @powersync/web, le schéma et le connecteur
// sont simulés ; proprietaire.js est le vrai.
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/miroir-proprietaire.test.js
// Sans ce drapeau (npm test), le test est ignoré.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const stock = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (stock.has(k) ? stock.get(k) : null),
    setItem: (k, v) => stock.set(k, String(v)),
    removeItem: (k) => stock.delete(k),
  },
});

const appels = [];
class FausseBase {
  async connect() { appels.push("connect"); }
  async disconnect() { appels.push("disconnect"); }
  async disconnectAndClear() { appels.push("clear"); }
  onChange(gestion, options) {
    appels.push(["onChange", options.tables]);
    this.gestion = gestion;
    return () => appels.push("stop");
  }
}

async function monter() {
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module("@powersync/web", { namedExports: { PowerSyncDatabase: FausseBase } });
  mock.module(url("../src/backend/powersync/schema.js"), { namedExports: { AppSchema: {} } });
  mock.module(url("../src/backend/powersync/connector.js"), { namedExports: { SupabaseConnector: class {} } });
  mock.module(url("../src/backend/powersync/tables.js"), { namedExports: { powerSyncConfigured: true } });
  return import("../src/backend/powersync/client.js");
}

const proprietaire = () => stock.get("LC_powersync_proprietaire") ?? null;
const raz = () => { appels.length = 0; };

test("miroir hors ligne et compte propriétaire", { skip: ignore }, async (t) => {
  const client = await monter();

  await t.test("premier démarrage (miroir sans propriétaire) : adopté, pas vidé", async () => {
    raz();
    await client.connectPowerSync("u1");
    assert.deepEqual(appels, ["connect"]);
    assert.equal(proprietaire(), "u1");
  });

  await t.test("appels répétés pour le même compte : une seule connexion", async () => {
    raz();
    await client.connectPowerSync("u1");
    assert.deepEqual(appels, []);
  });

  await t.test("déconnexion puis retour du même compte : miroir GARDÉ", async () => {
    raz();
    await client.disconnectPowerSync();
    await client.connectPowerSync("u1");
    assert.deepEqual(appels, ["disconnect", "connect"]);
    assert.equal(proprietaire(), "u1");
  });

  await t.test("un autre compte se connecte : miroir vidé AVANT la synchro", async () => {
    raz();
    await client.disconnectPowerSync();
    await client.connectPowerSync("u2");
    assert.deepEqual(appels, ["disconnect", "clear", "connect"]);
    assert.equal(proprietaire(), "u2");
  });

  await t.test("déconnexion et connexion lancées sans attendre : l'ordre est tenu", async () => {
    raz();
    const a = client.disconnectPowerSync();
    const b = client.connectPowerSync("u3");
    await Promise.all([a, b]);
    assert.deepEqual(appels, ["disconnect", "clear", "connect"]);
  });

  await t.test("effacerMiroir : données et propriétaire oubliés", async () => {
    raz();
    await client.effacerMiroir();
    assert.deepEqual(appels, ["clear"]);
    assert.equal(proprietaire(), null);
  });

  await t.test("ecouterTables : écoute du miroir et arrêt", async () => {
    raz();
    let recus = 0;
    const arreter = client.ecouterTables(["notes"], () => { recus += 1; });
    client.getPowerSync().gestion.onChange({ changedTables: ["notes"] });
    arreter();
    assert.equal(recus, 1);
    assert.deepEqual(appels, [["onChange", ["notes"]], "stop"]);
  });
});
