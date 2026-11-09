// Ouverture de l'app : les données du miroir local ne doivent pas attendre le
// réseau. Toute lecture résout d'abord l'uuid de l'école (ecoleIdFromCode,
// data-supabase.js) ; l'uuid déjà gardé sur l'appareil doit être servi
// aussitôt, le serveur n'étant attendu que la toute première fois.
//
// Mocks de modules requis (comme chargement-hors-ligne.test.js) :
//   node --import tsx --experimental-test-module-mocks --test tests/ecole-id-sans-reseau.test.js
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const CODE = "citadelle";
const CLEF = `LC_ecole_id_${CODE}`;

// Serveur simulé : chaque requête `ecoles` reste en vol jusqu'à repondre().
const serveur = { demandes: [] };
const repondre = (data) => { for (const fin of serveur.demandes.splice(0)) fin({ data }); };
const stock = new Map();
// Lignes du miroir local, relues telles quelles.
const miroir = { lectures: [] };

// Mocks posés une fois ; chaque « ouverture de l'app » est une instance neuve
// du module (cache mémoire vide), obtenue par un suffixe d'URL.
{
  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/backend/powersync/client.js"), {
    namedExports: {
      getPowerSync: () => ({
        getAll: async (_sql, params = []) => {
          miroir.lectures.push(params[0]);
          return [{ id: "n1", ecole_id: params[0], section: "primaire", eleve_id: "e1", note: 12, periode: "T1" }];
        },
        get: async (_sql, params = []) => { miroir.lectures.push(params[0]); return { n: 7 }; },
      }),
    },
  });
  mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: {
      powerSyncConfigured: true,
      estCouvertHorsLigne: () => true,
      parseJsonCols: (_table, ligne) => ligne,
      stringifyJsonCols: (_table, ligne) => ligne,
    },
  });
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: {
      getSupabase: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => new Promise((fin) => { serveur.demandes.push(fin); }),
            }),
          }),
        }),
      }),
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
  });
}
let ouvertures = 0;
const ouvrirApp = () => import(`../src/backend/data-supabase.js?ouverture=${++ouvertures}`);

const bientot = (ms = 20) => new Promise((fin) => { setTimeout(fin, ms); });
// Résultat de la promesse, ou "en attente" si elle n'a pas abouti à temps.
const sansAttendre = (promesse) => Promise.race([promesse, bientot(200).then(() => "en attente")]);

test("uuid de l'école : servi depuis l'appareil sans attendre le réseau", { skip: ignore }, async (t) => {
  const { chargerCollection } = await ouvrirApp();

  await t.test("première fois (uuid inconnu) : dix lectures, UNE requête, toutes servies", async () => {
    const lectures = Array.from({ length: 10 }, () => chargerCollection(CODE, "notesPrimaire", {}));
    await bientot();
    assert.equal(serveur.demandes.length, 1, "requêtes simultanées partagées");
    assert.equal(await sansAttendre(lectures[0]), "en attente", "uuid inconnu : le serveur est attendu");
    repondre({ id: "ec1" });
    const resultats = await Promise.all(lectures);
    assert.ok(resultats.every((r) => r.items.length === 1 && !r.erreur));
    assert.equal(stock.get(CLEF), "ec1", "uuid gardé sur l'appareil");
    assert.equal(serveur.demandes.length, 0, "plus aucune requête ensuite");
    await chargerCollection(CODE, "notesPrimaire", {});
    assert.equal(serveur.demandes.length, 0);
  });
});

test("uuid connu de l'appareil : le miroir répond même si le serveur ne répond jamais", { skip: ignore }, async (t) => {
  // Nouvelle ouverture de l'app : mémoire vide, uuid dans localStorage.
  stock.clear();
  stock.set(CLEF, "ec1");
  serveur.demandes.length = 0;
  miroir.lectures.length = 0;
  const { chargerCollection, compterElevesActifs, resoudreEcoleId } = await ouvrirApp();

  await t.test("lecture, comptage et abonnement aboutissent sans réponse du serveur", async () => {
    const lu = await sansAttendre(chargerCollection(CODE, "notesPrimaire", {}));
    assert.notEqual(lu, "en attente", "la lecture locale n'attend pas le réseau");
    assert.equal(lu.items.length, 1);
    assert.equal(await sansAttendre(compterElevesActifs(CODE)), 7);
    assert.equal(await sansAttendre(resoudreEcoleId(CODE)), "ec1");
    assert.deepEqual([...new Set(miroir.lectures)], ["ec1"]);
    assert.equal(serveur.demandes.length, 1, "un seul contrôle serveur en arrière-plan");
  });

  await t.test("école recréée sous le même code : l'appareil se corrige seul", async () => {
    repondre({ id: "ec2" });
    await bientot();
    assert.equal(stock.get(CLEF), "ec2");
    assert.equal(await resoudreEcoleId(CODE), "ec2");
  });

  await t.test("contrôle serveur en échec (hors ligne) : l'uuid de l'appareil reste", async () => {
    stock.set(CLEF, "ec2");
    const m = await ouvrirApp();
    assert.equal(await sansAttendre(m.resoudreEcoleId(CODE)), "ec2");
    repondre(null);
    await bientot();
    assert.equal(stock.get(CLEF), "ec2");
    assert.equal(await m.resoudreEcoleId(CODE), "ec2");
  });
});
