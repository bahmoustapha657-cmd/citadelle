// changerSectionDoc : la promotion qui fait changer un élève de SECTION.
//
// Défaut d'origine (La Citadelle, rentrée 2026) : les Grande Section promus en
// « 1ère Année A » avaient bien changé de classe, mais leur fiche était restée
// RANGÉE au préscolaire — chaque module ne lisant que sa section, ils y
// restaient affichés. Ici on vérifie ce que voient les modules après le
// déplacement : le VRAI data-supabase.js, la VRAIE lecture locale
// (local-data.js) sur un SQLite réel tenant lieu du miroir PowerSync, et un
// faux client Supabase pour le chemin en ligne.
//
// Il faut les mocks de modules du test runner :
//   node --import tsx --experimental-test-module-mocks --test tests/changer-section.test.js
// Sans ce drapeau (npm test), le test est ignoré ; promotion-utils.test.js
// couvre la décision (sectionApresPromotion) sans mocks.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";

const sqlite = await import("node:sqlite").catch(() => null);
const ignore = typeof mock.module !== "function"
  ? "mocks de modules absents : lancer avec --experimental-test-module-mocks"
  : !sqlite && "node:sqlite indisponible sur cette version de Node";

const ECOLE = { code: "citadelle", id: "ec1" };
const HISTORIQUE_2025 = { "2025-2026": { classe: "Grande Section A", archiveLe: "2026-06-30T00:00:00.000Z" } };

// Bascule du chemin testé : miroir local (hors ligne) ou réseau.
const etat = { horsLigne: true, rlsRefuse: false, serveur: {}, updates: [] };

// Faux client Supabase : juste les appels du chemin d'écriture.
const fauxClient = {
  from: (table) => ({
    select: (cols) => ({
      eq: (_col, valeur) => ({
        maybeSingle: async () => {
          if (table === "ecoles") return { data: valeur === ECOLE.code ? { id: ECOLE.id } : null };
          const ligne = etat.serveur[valeur];
          return { data: ligne ? { [cols]: ligne[cols] } : null };
        },
      }),
    }),
    update: (row) => ({
      eq: (_col, id) => ({
        select: async () => {
          etat.updates.push({ table, id, row });
          // La RLS n'oppose pas d'erreur : elle ignore la ligne refusée.
          if (etat.rlsRefuse || !etat.serveur[id]) return { data: [], error: null };
          Object.assign(etat.serveur[id], row);
          return { data: [{ id }], error: null };
        },
      }),
    }),
  }),
};

async function monter() {
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
  // Le jsonb `extra` vit en TEXT dans le miroir, comme en production.
  const json = (sens) => (table, ligne) => {
    if (table !== "eleves" || !ligne || ligne.extra == null) return ligne;
    if (sens === "lire" && typeof ligne.extra === "string") return { ...ligne, extra: JSON.parse(ligne.extra) };
    if (sens === "ecrire" && typeof ligne.extra !== "string") return { ...ligne, extra: JSON.stringify(ligne.extra) };
    return ligne;
  };
  mock.module(url("../src/backend/powersync/tables.js"), {
    namedExports: {
      powerSyncConfigured: true,
      estCouvertHorsLigne: (table) => etat.horsLigne && table === "eleves",
      parseJsonCols: json("lire"),
      stringifyJsonCols: json("ecrire"),
    },
  });
  mock.module(url("../src/supabaseClient.js"), {
    namedExports: { getSupabase: () => fauxClient },
  });
  // ecoleIdFromCode met l'uuid en cache dans localStorage.
  const stock = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, String(v)) },
  });

  db.prepare("INSERT INTO eleves (id, ecole_id, section, nom, prenom, classe, statut, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run("e1", ECOLE.id, "prescolaire", "Barry", "Moussa", "Grande Section A", "Actif",
      JSON.stringify({ typeInscription: "Réinscription", mens: { Octobre: "Payé" } }));
  return import("../src/backend/data-supabase.js");
}

test("promotion inter-sections : la fiche change de module", { skip: ignore }, async (t) => {
  const { changerSectionDoc, chargerCollection } = await monter();
  const ids = async (collection) => (await chargerCollection(ECOLE.code, collection)).items.map((e) => e._id);

  await t.test("hors ligne : Grande Section → 1ère Année quitte le préscolaire pour le primaire", async () => {
    assert.deepEqual(await ids("elevesPrescolaire"), ["e1"]);
    assert.deepEqual(await ids("elevesPrimaire"), []);

    await changerSectionDoc(ECOLE.code, "elevesPrescolaire", "e1", "primaire",
      { classe: "1ère Année A", historique: HISTORIQUE_2025 });

    assert.deepEqual(await ids("elevesPrescolaire"), [], "plus affiché au préscolaire");
    const [eleve] = (await chargerCollection(ECOLE.code, "elevesPrimaire")).items;
    assert.equal(eleve?._id, "e1", "affiché au primaire");
    assert.equal(eleve.classe, "1ère Année A");
    assert.equal(eleve.section, "primaire");
    // Le jsonb est FUSIONNÉ : l'instantané s'ajoute, la scolarité reste.
    assert.deepEqual(eleve.historique, HISTORIQUE_2025);
    assert.equal(eleve.typeInscription, "Réinscription");
    assert.deepEqual(eleve.mens, { Octobre: "Payé" });
  });

  await t.test("en ligne : UNE requête porte la section, la classe et le jsonb fusionné", async () => {
    etat.horsLigne = false;
    etat.serveur = { e2: { id: "e2", section: "primaire", classe: "6ème Année A", extra: { resultatExamen: "Admis" } } };
    etat.updates = [];

    await changerSectionDoc(ECOLE.code, "elevesPrimaire", "e2", "college", { classe: "7ème Année A" });

    assert.equal(etat.updates.length, 1, "jamais de fiche à moitié déplacée");
    assert.deepEqual(etat.updates[0].row, { classe: "7ème Année A", section: "college" });
    assert.equal(etat.serveur.e2.section, "college");

    await changerSectionDoc(ECOLE.code, "elevesPrimaire", "e2", "college", { historique: HISTORIQUE_2025 });
    assert.deepEqual(etat.serveur.e2.extra, { resultatExamen: "Admis", historique: HISTORIQUE_2025 });
  });

  await t.test("en ligne : un refus de la RLS (zéro ligne) n'est pas pris pour un succès", async () => {
    etat.horsLigne = false;
    etat.rlsRefuse = true;
    etat.serveur = { e3: { id: "e3", section: "prescolaire", classe: "Grande Section A", extra: {} } };
    await assert.rejects(
      changerSectionDoc(ECOLE.code, "elevesPrescolaire", "e3", "primaire", { classe: "1ère Année A" }),
      /Déplacement refusé/,
    );
    etat.rlsRefuse = false;
  });

  await t.test("section inconnue ou collection non sectionnée : refusé avant toute écriture", async () => {
    etat.updates = [];
    await assert.rejects(changerSectionDoc(ECOLE.code, "elevesPrescolaire", "e1", "maternelle", {}), /invalide/);
    await assert.rejects(changerSectionDoc(ECOLE.code, "tarifs", "t1", "primaire", {}), /invalide/);
    assert.equal(etat.updates.length, 0);
  });
});
