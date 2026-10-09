// Bout en bout, hors React, du compteur d'élèves actifs qui applique la limite
// du plan : le VRAI compterElevesActifs (data-supabase.js), la VRAIE lecture et
// les VRAIES écritures locales (local-data.js) sur un SQLite réel qui tient
// lieu du miroir PowerSync, le VRAI surveillerTable (realtime-supabase.js) et
// suivreCompteur, branchés comme dans useSchoolData. Seuls sont simulés les
// modules liés au navigateur ou au réseau : le client PowerSync, le client
// Supabase, et tables.js (il lit import.meta.env, propre à Vite).
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/compteur-eleves-supabase.test.js
// Sans ce drapeau (npm test), le test est ignoré ; limite-eleves.test.js
// couvre la logique pure (recomptage, règle de blocage) sans mocks.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";
import { suivreCompteur } from "../src/hooks/suivre-compteur.js";

const sqlite = await import("node:sqlite").catch(() => null);
const ignore = typeof mock.module !== "function"
  ? "mocks de modules absents : lancer avec --experimental-test-module-mocks"
  : !sqlite && "node:sqlite indisponible sur cette version de Node";

const ECOLE = { code: "gs-fatoumata", id: "ec1" };

// Toutes les sections comptent, préscolaire compris ; ni les départs ni
// l'autre école → 4 élèves actifs.
const ELEVES = [
  { id: "e1", ecole_id: "ec1", section: "primaire", statut: "Actif" },
  { id: "e2", ecole_id: "ec1", section: "college", statut: "Actif" },
  { id: "e3", ecole_id: "ec1", section: "prescolaire", statut: "Actif" },
  { id: "e4", ecole_id: "ec1", section: "lycee", statut: "Actif" },
  { id: "e5", ecole_id: "ec1", section: "college", statut: "Transféré" },
  { id: "e6", ecole_id: "ec1", section: "primaire", statut: "Exclu" },
  { id: "e7", ecole_id: "ec2", section: "primaire", statut: "Actif" },
];

// PowerSync configuré (la prod) ou non (Supabase en ligne seulement).
let miroirActif = true;

async function monter() {
  // ── Miroir PowerSync : SQLite réel au schéma de l'app ──
  const db = new sqlite.DatabaseSync(":memory:");
  for (const t of AppSchema.toJSON().tables) {
    db.exec(`CREATE TABLE ${t.name} (id TEXT PRIMARY KEY, ${t.columns.map((c) => c.name).join(", ")})`);
  }
  for (const l of ELEVES) {
    const cols = Object.keys(l);
    db.prepare(`INSERT INTO eleves (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .run(...cols.map((c) => l[c]));
  }
  // Toute écriture notifie les écouteurs onChange de sa table, comme le font
  // les triggers des vues PowerSync.
  const ecouteurs = new Set();
  const notifier = (sql) => {
    const table = /^\s*(?:INSERT(?:\s+OR\s+REPLACE)?\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql)?.[1];
    for (const e of [...ecouteurs]) if (e.tables.includes(table)) e.onChange({ changedTables: [table] });
  };
  const ps = {
    get: async (sql, params = []) => db.prepare(sql).get(...params),
    getAll: async (sql, params = []) => db.prepare(sql).all(...params),
    getOptional: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
    execute: async (sql, params = []) => {
      const r = db.prepare(sql).run(...params);
      notifier(sql);
      return r;
    },
    onChangeWithCallback: ({ onChange }, { tables }) => {
      const e = { onChange, tables };
      ecouteurs.add(e);
      return () => ecouteurs.delete(e);
    },
  };

  // ── Serveur Supabase : sa propre copie des élèves ──
  const serveur = ELEVES.map((l) => ({ ...l }));
  const requetes = [];
  const canaux = [];
  const retires = [];
  const requete = (table) => {
    const filtres = [];
    let options = {};
    const q = {
      select: (_cols, opts = {}) => { options = opts; return q; },
      eq: (col, val) => { filtres.push([col, val]); return q; },
      maybeSingle: async () => ({
        data: table === "ecoles" && filtres.some(([c, v]) => c === "code" && v === ECOLE.code)
          ? { id: ECOLE.id } : null,
      }),
      // Requête attendue : un comptage `head` ne renvoie que le total, comme PostgREST.
      then: (resoudre, rejeter) => {
        requetes.push({ table, filtres, options });
        const lignes = serveur.filter((l) => filtres.every(([c, v]) => l[c] === v));
        return Promise.resolve(options.head
          ? { data: null, count: options.count === "exact" ? lignes.length : null, error: null }
          : { data: lignes, error: null }).then(resoudre, rejeter);
      },
    };
    return q;
  };
  const sb = {
    from: requete,
    channel: (nom) => {
      const canal = {
        nom,
        on: (_type, filtre, emettre) => Object.assign(canal, { filtre, emettre }),
        subscribe: () => canal,
      };
      canaux.push(canal);
      return canal;
    },
    removeChannel: (canal) => retires.push(canal),
  };

  const url = (chemin) => new URL(chemin, import.meta.url).href;
  mock.module(url("../src/backend/powersync/client.js"), { namedExports: { getPowerSync: () => ps } });
  mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: {
      powerSyncConfigured: true,
      estCouvertHorsLigne: (table) => miroirActif && table === "eleves",
      parseJsonCols: (_table, ligne) => ligne,
      // Le jsonb `extra` part en TEXT, comme le vrai stringifyJsonCols.
      stringifyJsonCols: (_table, ligne) => Object.fromEntries(Object.entries(ligne)
        .map(([k, v]) => [k, v && typeof v === "object" ? JSON.stringify(v) : v])),
    },
  });
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: { supabaseConfigured: true, getSupabase: () => sb },
  });

  // ecoleIdFromCode met l'uuid en cache dans localStorage ; le mode en ligne
  // écoute le retour d'onglet et de réseau.
  const stock = new Map();
  const globaux = {
    localStorage: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
    document: Object.assign(new EventTarget(), { visibilityState: "visible" }),
    window: new EventTarget(),
  };
  for (const [nom, value] of Object.entries(globaux)) {
    Object.defineProperty(globalThis, nom, { configurable: true, value });
  }

  return {
    ...(await import("../src/backend/data-supabase.js")),
    ...(await import("../src/backend/realtime-supabase.js")),
    serveur, requetes, canaux, retires, ecouteurs,
  };
}

// Attend qu'une condition devienne vraie (écritures, imports dynamiques et
// recomptages sont asynchrones).
async function attendre(condition, message) {
  for (let i = 0; i < 400; i++) {
    if (condition()) return;
    await new Promise((resoudre) => setTimeout(resoudre, 5));
  }
  assert.fail(`délai dépassé : ${message}`);
}

// Branchement de useSchoolData, recomptage rapide pour le test.
function suivre(m) {
  const valeurs = [];
  const arreter = suivreCompteur({
    compter: () => m.compterElevesActifs(ECOLE.code),
    surveiller: (signaler) => m.surveillerTable(ECOLE.code, "eleves", signaler),
    onValeur: (v) => valeurs.push(v),
    delaiMs: 5,
  });
  return { valeurs, arreter };
}

test("compteur d'élèves actifs sur Supabase (limite du plan)", { skip: ignore }, async (t) => {
  const m = await monter();

  await t.test("miroir PowerSync : toutes sections, préscolaire compris, sans départs ni autre école, sans réseau", async () => {
    miroirActif = true;
    assert.equal(await m.compterElevesActifs(ECOLE.code), 4);
    assert.equal(m.requetes.filter((r) => r.table === "eleves").length, 0, "aucune requête réseau sur eleves");
  });

  await t.test("miroir PowerSync : départ, réintégration et inscription recomptés aussitôt", async () => {
    miroirActif = true;
    const { valeurs, arreter } = suivre(m);
    await attendre(() => valeurs.length === 1 && m.ecouteurs.size === 1, "comptage initial + surveillance du miroir");

    // Départ (EnrolTable : statut « Transféré »), par la vraie écriture locale.
    await m.modifierChampDoc(ECOLE.code, "elevesCollege", "e2", { statut: "Transféré" });
    await attendre(() => valeurs.length === 2, "recomptage après le départ");
    // Réintégration (DepartsView : retour à « Actif »).
    await m.modifierChampDoc(ECOLE.code, "elevesCollege", "e2", { statut: "Actif" });
    await attendre(() => valeurs.length === 3, "recomptage après la réintégration");
    // Inscription d'un nouvel élève en préscolaire.
    await m.ajouterDoc(ECOLE.code, "elevesPrescolaire", {
      nom: "Diallo", prenom: "Aïssatou", statut: "Actif", typeInscription: "Première inscription",
    });
    await attendre(() => valeurs.length === 4, "recomptage après l'inscription");
    assert.deepEqual(valeurs, [4, 3, 4, 5]);
    assert.equal(m.canaux.length, 0, "pas de canal Realtime en doublon du miroir");

    arreter();
    assert.equal(m.ecouteurs.size, 0, "surveillance du miroir détachée");
  });

  await t.test("en ligne : comptage `head` filtré par école et statut, recompté sur Realtime et au retour du réseau", async () => {
    miroirActif = false;
    const { valeurs, arreter } = suivre(m);
    await attendre(() => valeurs.length === 1 && m.canaux.length === 1, "comptage initial + canal Realtime");
    assert.deepEqual(valeurs, [4]);
    const comptage = m.requetes.findLast((r) => r.table === "eleves");
    assert.deepEqual(comptage.options, { count: "exact", head: true }, "le total seul, aucune ligne");
    assert.deepEqual(comptage.filtres, [["ecole_id", ECOLE.id], ["statut", "Actif"]]);
    const [canal] = m.canaux;
    assert.equal(canal.filtre.table, "eleves");
    assert.equal(canal.filtre.filter, `ecole_id=eq.${ECOLE.id}`);

    // Un autre poste inscrit un élève : Realtime le signale.
    m.serveur.push({ id: "e8", ecole_id: ECOLE.id, section: "lycee", statut: "Actif" });
    canal.emettre({ eventType: "INSERT", new: { id: "e8" } });
    await attendre(() => valeurs.length === 2, "recomptage sur l'événement Realtime");
    // Départ survenu pendant une coupure (événement perdu) : le retour du
    // réseau recompte.
    m.serveur.find((l) => l.id === "e1").statut = "Exclu";
    globalThis.window.dispatchEvent(new Event("online"));
    await attendre(() => valeurs.length === 3, "recomptage au retour du réseau");
    assert.deepEqual(valeurs, [4, 5, 4]);

    arreter();
    assert.deepEqual(m.retires, [canal], "canal Realtime fermé");
    const requetesAvant = m.requetes.length;
    globalThis.window.dispatchEvent(new Event("online"));
    globalThis.document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resoudre) => setTimeout(resoudre, 30));
    assert.equal(m.requetes.length, requetesAvant, "plus aucun recomptage après l'arrêt");
  });

  await t.test("école introuvable : le comptage échoue au lieu de valoir 0", async () => {
    await assert.rejects(m.compterElevesActifs("ecole-inconnue"), /introuvable/);
  });
});
