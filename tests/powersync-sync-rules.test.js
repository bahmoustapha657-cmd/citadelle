// Règles de synchro PowerSync (supabase/powersync-sync-rules*.yaml, au format
// Sync Streams depuis le 2026-10-27) : elles ne sont exécutées que par
// PowerSync Cloud, après collage manuel de la version .min.yaml dans le
// tableau de bord — une erreur ne se verrait qu'en prod. On vérifie ici que :
//   • la version .min.yaml est bien le fichier commenté sans ses commentaires
//     (c'est elle qu'on colle ; les deux ont déjà divergé par le passé) ;
//   • le format est celui des Sync Streams, sans changer la forme des
//     valeurs livrées (correctifs de l'édition 2 coupés) ;
//   • chaque flux part à la connexion, comme les anciens buckets ;
//   • les priorités suivent le plan « réseau faible » : l'essentiel d'abord,
//     les notes ensuite, les modules secondaires en dernier, jamais 0 ;
//   • le périmètre de chaque compte est celui des anciennes Sync Rules ;
//   • chaque table du miroir local (schema.js) est bien synchronisée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AppSchema } from "../src/backend/powersync/schema.js";

const lire = (nom) => readFileSync(new URL(`../supabase/${nom}`, import.meta.url), "utf8").replace(/\r/g, "");
const commente = lire("powersync-sync-rules.yaml");
const compacte = lire("powersync-sync-rules.min.yaml");

// Lecture minimale du YAML : bloc `config` (clé: valeur sur 2 espaces) et
// flux de `streams` — nom (2 espaces), auto_subscribe, priority, CTE du
// `with` (6 espaces) et requêtes de `queries` (6 espaces + « - »).
function lireRegles(yaml) {
  const config = {};
  const flux = {};
  let bloc = null;
  let courant = null;
  for (const ligne of yaml.split("\n")) {
    if (/^\S/.test(ligne)) { bloc = ligne.replace(/:.*$/, ""); courant = null; continue; }
    if (bloc === "config") {
      const option = ligne.match(/^ {2}([a-z_0-9]+):\s*(\S+)\s*$/);
      if (option) config[option[1]] = option[2];
      continue;
    }
    if (bloc !== "streams") continue;
    const nom = ligne.match(/^ {2}([a-z_]+):\s*$/);
    if (nom) { courant = flux[nom[1]] = { auto: false, priorite: null, ctes: {}, requetes: [] }; continue; }
    if (!courant) continue;
    if (/^ {4}auto_subscribe:\s*true\s*$/.test(ligne)) courant.auto = true;
    const prio = ligne.match(/^ {4}priority:\s*(\d+)\s*$/);
    if (prio) courant.priorite = Number(prio[1]);
    const cte = ligne.match(/^ {6}([a-z_]+):\s*(SELECT .*)$/);
    if (cte) courant.ctes[cte[1]] = cte[2];
    const requete = ligne.match(/^ {6}- (SELECT .*)$/);
    if (requete) courant.requetes.push(requete[1]);
  }
  return { config, flux };
}
const { config, flux } = lireRegles(compacte);
const tablesDe = (def) => def.requetes.map((r) => r.match(/ FROM ([a-z_]+)/)[1]);

test("la version à coller (.min.yaml) = le fichier commenté sans commentaires", () => {
  const sansCommentaires = commente.split("\n")
    .filter((l) => !/^\s*#/.test(l) && l.trim() !== "")
    .join("\n");
  assert.equal(compacte.trim(), sansCommentaires.trim());
});

// Les Sync Rules (bucket_definitions) sont dépréciées. L'édition 3 (compilateur
// des Sync Streams) allumerait aussi les correctifs de l'édition 2 qui
// changent la forme des valeurs (dates ISO 8601, types personnalisés, `->>`) :
// coupés, le miroir garde exactement les valeurs d'avant.
test("format Sync Streams, valeurs livrées inchangées", () => {
  assert.doesNotMatch(compacte, /bucket_definitions|request\.|bucket\./);
  assert.deepEqual(config, {
    edition: "3",
    timestamps_iso8601: "false",
    fixed_json_extract: "false",
    custom_postgres_types: "false",
  });
});

// Comme les anciens buckets, tout arrive à la connexion : l'app ne s'abonne
// à aucun flux. Un flux sans auto_subscribe n'arriverait jamais. Seule
// l'identité du jeton (auth.user_id()) choisit les données, jamais un
// paramètre fourni par le client.
test("chaque flux part à la connexion, filtré par le seul jeton", () => {
  for (const [nom, def] of Object.entries(flux)) {
    assert.ok(def.auto, `${nom} : auto_subscribe: true`);
    for (const filtre of Object.values(def.ctes)) assert.match(filtre, /user_id = auth\.user_id\(\)/, nom);
  }
  assert.doesNotMatch(compacte, /connection\.|subscription\./);
});

test("priorités : l'essentiel d'abord, les notes ensuite, le reste en dernier", () => {
  const prioriteDe = (table) => [...new Set(Object.values(flux)
    .filter((x) => tablesDe(x).includes(table)).map((x) => x.priorite))];

  for (const [nom, def] of Object.entries(flux)) {
    assert.ok([1, 2, 3].includes(def.priorite), `${nom} : priorité 1 à 3 explicite (jamais 0)`);
  }
  for (const t of ["eleves", "classes", "matieres", "enseignants", "emplois", "appreciations", "ecoles", "postes", "salaires", "tarifs"]) {
    assert.deepEqual(prioriteDe(t), [1], t);
  }
  for (const t of ["notes", "absences"]) assert.deepEqual(prioriteDe(t), [2], t);
  for (const t of ["historique", "livrets", "comptes", "messages", "evenements"]) assert.deepEqual(prioriteDe(t), [3], t);
});

// Une table qui change de flux disparaît un moment du miroir quand les
// règles sont redéployées (le nouveau bucket n'est pas encore livré alors que
// l'ancien ne la contient plus) — et une saisie à ce moment-là crée un
// doublon. Tout déplacement doit donc être délibéré : mettre à jour ce relevé.
// Un flux par ancien bucket de bucket_definitions, même nom, même contenu.
test("contenu des flux figé (un déplacement de table doit être délibéré)", () => {
  const releve = Object.fromEntries(Object.entries(flux).map(([nom, def]) => [nom, tablesDe(def)]));
  assert.deepEqual(releve, {
    school_data: ["eleves", "classes", "matieres", "enseignants", "emplois", "enseignements", "appreciations", "ecoles", "annonces", "postes"],
    teacher_notes: ["notes", "absences"],
    staff_notes: ["notes", "absences"],
    // paiements (journal des encaissements) ajouté le 2026-10-06 : nouvelle
    // table du miroir, aucune autre ne change de bucket.
    // presences (registre des absences du personnel) ajouté le 2026-10-10.
    // paie_enseignants (paie sortie de la fiche enseignant) ajouté le 2026-10-27.
    compta_data: ["recettes", "depenses", "versements", "bons", "personnel", "salaires", "tarifs", "paiements", "presences", "paie_enseignants"],
    calendrier_data: ["evenements"],
    examens_data: ["examens", "livrets", "honneurs"],
    messages_data: ["messages"],
    fondation_data: ["membres", "documents"],
    historique_data: ["historique"],
    admin_data: ["comptes"],
  });
});

// Qui reçoit quoi : ce sont les anciennes Parameter Queries, mot pour mot
// (request.user_id() → auth.user_id()). La RLS reste l'autorité ; ces gardes
// ne font que la refléter.
test("périmètre de chaque compte = celui des anciennes Sync Rules", () => {
  const compte = (condition) => `SELECT ecole_id FROM comptes WHERE user_id = auth.user_id() AND ${condition}`;
  const gardes = Object.fromEntries(Object.entries(flux).map(([nom, def]) => [nom, def.ctes]));
  assert.deepEqual(gardes, {
    school_data: { ecole_du_compte: compte("role != 'parent'") },
    teacher_notes: { sections_enseignant: "SELECT section, ecole_id FROM enseignant_classes WHERE user_id = auth.user_id()" },
    staff_notes: { ecole_du_compte: compte("role != 'parent' AND role != 'enseignant'") },
    compta_data: { ecole_du_compte: compte("perm_compta = true") },
    calendrier_data: { ecole_du_compte: compte("perm_calendrier = true") },
    examens_data: { ecole_du_compte: compte("perm_examens = true") },
    messages_data: { ecole_du_compte: compte("perm_messages = true") },
    fondation_data: { ecole_du_compte: compte("perm_fondation = true") },
    historique_data: { ecole_du_compte: compte("perm_historique = true") },
    admin_data: { ecole_du_compte: compte("perm_admin_panel = true") },
  });

  for (const [nom, def] of Object.entries(flux)) {
    for (const [i, requete] of def.requetes.entries()) {
      const t = tablesDe(def)[i];
      // Enseignant : jointure sur le COUPLE (école, section) de chacune de
      // ses lignes d'enseignant_classes — deux `IN` séparés croiseraient
      // écoles et sections.
      const attendue = nom === "teacher_notes"
        ? `SELECT ${t}.* FROM ${t}, sections_enseignant AS ec WHERE ${t}.ecole_id = ec.ecole_id AND ${t}.section = ec.section`
        : `SELECT * FROM ${t} WHERE ${t === "ecoles" ? "id" : "ecole_id"} IN ecole_du_compte`;
      assert.equal(requete, attendue, nom);
    }
  }
});

test("chaque table du miroir local est synchronisée par au moins un flux", () => {
  const synchronisees = new Set(Object.values(flux).flatMap(tablesDe));
  const manquantes = AppSchema.toJSON().tables.map((t) => t.name).filter((t) => !synchronisees.has(t));
  assert.deepEqual(manquantes, []);
});
