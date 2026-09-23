// Lecture hors ligne (miroir PowerSync) : mêmes tranches qu'en ligne.
// PowerSync est actif en production, donc c'est CE chemin qui sert les notes.
// Deux régressions réelles ont motivé ces tests :
//   • `periode` / `saufPeriode` étaient ignorés hors ligne : le chargement en
//     deux temps du module École (useFirestore) recevait deux fois toute la
//     tranche, et chaque note apparaissait en double ;
//   • appreciations et salaires n'étaient pas filtrés par année hors ligne, et
//     leur vue locale n'avait même pas la colonne `annee`.
// Les requêtes tournent sur un vrai SQLite dont les tables sont générées
// depuis le schéma PowerSync de l'app : une colonne absente du miroir fait
// échouer le test au lieu de passer inaperçue.
import test from "node:test";
import assert from "node:assert/strict";
import { AppSchema } from "../src/backend/powersync/schema.js";
import { ANNEE_TABLES, PERIODE_TABLES, clauseLectureLocale } from "../src/backend/filtres-lecture.js";

const sqlite = await import("node:sqlite").catch(() => null);
const sansSqlite = !sqlite && "node:sqlite indisponible sur cette version de Node";

const SCHEMA = AppSchema.toJSON().tables;
const TYPES_SQL = { TEXT: "TEXT", INTEGER: "INTEGER", REAL: "REAL" };

// Base SQLite en mémoire aux colonnes EXACTES du miroir local.
function miroir() {
  const db = new sqlite.DatabaseSync(":memory:");
  for (const t of SCHEMA) {
    const cols = t.columns.map((c) => `${c.name} ${TYPES_SQL[c.type] || "TEXT"}`);
    db.exec(`CREATE TABLE ${t.name} (id TEXT PRIMARY KEY, ${cols.join(", ")})`);
  }
  return db;
}

function inserer(db, table, lignes) {
  for (const ligne of lignes) {
    const cols = Object.keys(ligne);
    db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .run(...cols.map((c) => ligne[c]));
  }
}

// Ce que fait lireLocal, sans le client PowerSync.
function lire(db, table, filtres) {
  const { where, params } = clauseLectureLocale(table, filtres);
  return db.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...params);
}
const ids = (lignes) => lignes.map((l) => l.id).sort();

const PRIMAIRE = { ecoleId: "ec1", section: "primaire", annee: "2025-2026" };
let seq = 0;
const note = (periode, extra = {}) => ({
  id: `n${++seq}`, ecole_id: "ec1", section: "primaire", annee: "2025-2026",
  eleve_id: "e1", matiere: "Maths", type: "Devoir", note: 12, periode, ...extra,
});

function notesPrimaire() {
  const db = miroir();
  inserer(db, "notes", [
    note("T1"), note("T1"), note("T1"), note("T2"), note("T2"), note("T3"),
    // Hors tranche : ne doivent jamais remonter.
    note("T1", { section: "college" }),
    note("T1", { annee: "2024-2025" }),
    note("T1", { ecole_id: "ec2" }),
  ]);
  return db;
}

test("chargement en deux temps : les deux lectures se complètent sans doublon", { skip: sansSqlite }, () => {
  const db = notesPrimaire();
  const tout = lire(db, "notes", PRIMAIRE);
  assert.equal(tout.length, 6);

  // Exactement ce que fait useFirestore quand periodePrioritaire est fourni.
  const dabord = lire(db, "notes", { ...PRIMAIRE, periode: "T1" });
  const reste = lire(db, "notes", { ...PRIMAIRE, saufPeriode: "T1" });
  const fusion = [...dabord, ...reste];

  assert.ok(dabord.every((n) => n.periode === "T1"));
  assert.ok(reste.every((n) => n.periode !== "T1"));
  assert.equal(new Set(fusion.map((n) => n.id)).size, fusion.length, "aucune note ne doit arriver deux fois");
  assert.deepEqual(ids(fusion), ids(tout), "rien ne doit manquer non plus");
});

test("`periode` l'emporte sur `saufPeriode`, comme la requête en ligne", { skip: sansSqlite }, () => {
  const db = notesPrimaire();
  const lignes = lire(db, "notes", { ...PRIMAIRE, periode: "T2", saufPeriode: "T2" });
  assert.equal(lignes.length, 2);
  assert.ok(lignes.every((n) => n.periode === "T2"));
});

// Migration des périodes (Paramètres → Périodicité) : l'outil ne lit que les
// notes HORS périodicité. Hors ligne, la liste était ignorée : la section
// entière remontait du miroir, là où PostgREST n'en renvoyait qu'une poignée.
test("`saufPeriodes` exclut toute une liste, comme .notIn en ligne", { skip: sansSqlite }, () => {
  const db = notesPrimaire();
  assert.deepEqual(lire(db, "notes", { ...PRIMAIRE, saufPeriodes: ["T1", "T2"] }).map((n) => n.periode), ["T3"]);
  // Liste vide : aucun filtre de période.
  assert.equal(lire(db, "notes", { ...PRIMAIRE, saufPeriodes: [] }).length, 6);
  // `periode` et `saufPeriode` priment, dans le même ordre que la requête en ligne.
  assert.equal(lire(db, "notes", { ...PRIMAIRE, periode: "T1", saufPeriodes: ["T1"] }).length, 3);
  assert.equal(lire(db, "notes", { ...PRIMAIRE, saufPeriode: "T3", saufPeriodes: ["T1", "T2"] }).length, 5);
  // Table sans colonne `periode` : option ignorée, pas de « no such column ».
  inserer(db, "eleves", [{ id: "e1", ecole_id: "ec1", section: "primaire", nom: "Bah" }]);
  assert.deepEqual(ids(lire(db, "eleves", { ...PRIMAIRE, saufPeriodes: ["T1"] })), ["e1"]);
});

test("sans filtre de période, toute la tranche section × année", { skip: sansSqlite }, () => {
  const db = notesPrimaire();
  assert.equal(lire(db, "notes", PRIMAIRE).length, 6);
  // Sans année : toutes les années de la section, mais jamais l'autre école.
  assert.equal(lire(db, "notes", { ecoleId: "ec1", section: "primaire" }).length, 7);
});

test("les appréciations suivent les mêmes filtres de période et d'année", { skip: sansSqlite }, () => {
  const db = miroir();
  const app = (id, periode, annee) => ({
    id, ecole_id: "ec1", section: "primaire", eleve_id: "e1", periode, annee, texte: "Bien",
  });
  inserer(db, "appreciations", [
    app("a1", "T1", "2025-2026"), app("a2", "T2", "2025-2026"),
    // Même élève, même période, AUTRE année : ne doit pas se confondre avec a1.
    app("a3", "T1", "2026-2027"),
  ]);
  assert.deepEqual(ids(lire(db, "appreciations", PRIMAIRE)), ["a1", "a2"]);
  assert.deepEqual(ids(lire(db, "appreciations", { ...PRIMAIRE, periode: "T1" })), ["a1"]);
  assert.deepEqual(ids(lire(db, "appreciations", { ...PRIMAIRE, saufPeriode: "T1" })), ["a2"]);
});

test("les salaires sont cloisonnés par année hors ligne", { skip: sansSqlite }, () => {
  // Appariés par MOIS : sans ce filtre, le « Novembre » de l'an dernier se
  // confondait avec celui de la nouvelle année (doublon bloquant, paie faussée).
  const db = miroir();
  inserer(db, "salaires", [
    { id: "s1", ecole_id: "ec1", nom: "Diallo", mois: "Novembre", montant_net: 100, annee: "2025-2026" },
    { id: "s2", ecole_id: "ec1", nom: "Diallo", mois: "Novembre", montant_net: 120, annee: "2026-2027" },
  ]);
  assert.deepEqual(ids(lire(db, "salaires", { ecoleId: "ec1", annee: "2026-2027" })), ["s2"]);
});

test("période et année ne visent que les tables qui portent la colonne", { skip: sansSqlite }, () => {
  const db = miroir();
  inserer(db, "eleves", [{ id: "e1", ecole_id: "ec1", section: "primaire", nom: "Bah" }]);
  // `eleves` n'a ni `periode` ni `annee` : les options doivent être ignorées,
  // pas finir en « no such column ».
  const lignes = lire(db, "eleves", { ...PRIMAIRE, periode: "T1", saufPeriode: "T2" });
  assert.deepEqual(ids(lignes), ["e1"]);
});

test("toute table du miroir filtrée par année ou par période porte la colonne", () => {
  // La vue locale d'une table PowerSync n'expose QUE les colonnes du schéma
  // client : une colonne manquante fait échouer la lecture filtrée ET toute
  // écriture qui la renseigne (« table appreciations has no column named annee »).
  const manquantes = [];
  for (const t of SCHEMA) {
    const cols = new Set(t.columns.map((c) => c.name));
    if (ANNEE_TABLES.has(t.name) && !cols.has("annee")) manquantes.push(`${t.name}.annee`);
    if (PERIODE_TABLES.has(t.name) && !cols.has("periode")) manquantes.push(`${t.name}.periode`);
  }
  assert.deepEqual(manquantes, []);
});
