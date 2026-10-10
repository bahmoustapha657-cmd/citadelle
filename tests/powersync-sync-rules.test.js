// Règles de synchro PowerSync (supabase/powersync-sync-rules*.yaml) : elles ne
// sont exécutées que par PowerSync Cloud, après collage manuel de la version
// .min.yaml dans le tableau de bord — une erreur ne se verrait qu'en prod.
// On vérifie ici que :
//   • la version .min.yaml est bien le fichier commenté sans ses commentaires
//     (c'est elle qu'on colle ; les deux ont déjà divergé par le passé) ;
//   • les priorités suivent le plan « réseau faible » : l'essentiel d'abord,
//     les notes ensuite, les modules secondaires en dernier, jamais 0 ;
//   • chaque table du miroir local (schema.js) est bien synchronisée.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AppSchema } from "../src/backend/powersync/schema.js";

const lire = (nom) => readFileSync(new URL(`../supabase/${nom}`, import.meta.url), "utf8").replace(/\r/g, "");
const commente = lire("powersync-sync-rules.yaml");
const compacte = lire("powersync-sync-rules.min.yaml");

// Lecture minimale de bucket_definitions : nom (2 espaces), priority,
// tables des requêtes `data`.
function buckets(yaml) {
  const res = {};
  let courant = null;
  for (const ligne of yaml.split("\n")) {
    const nom = ligne.match(/^ {2}([a-z_]+):\s*$/);
    if (nom) { courant = res[nom[1]] = { priorite: null, tables: [] }; continue; }
    if (!courant) continue;
    const prio = ligne.match(/^ {4}priority:\s*(\d+)\s*$/);
    if (prio) courant.priorite = Number(prio[1]);
    const donnee = ligne.match(/^ {6}- SELECT .* FROM ([a-z_]+)/);
    if (donnee) courant.tables.push(donnee[1]);
  }
  return res;
}

test("la version à coller (.min.yaml) = le fichier commenté sans commentaires", () => {
  const sansCommentaires = commente.split("\n")
    .filter((l) => !/^\s*#/.test(l) && l.trim() !== "")
    .join("\n");
  assert.equal(compacte.trim(), sansCommentaires.trim());
});

test("priorités : l'essentiel d'abord, les notes ensuite, le reste en dernier", () => {
  const b = buckets(compacte);
  const prioriteDe = (table) => [...new Set(Object.values(b)
    .filter((x) => x.tables.includes(table)).map((x) => x.priorite))];

  for (const [nom, def] of Object.entries(b)) {
    assert.ok([1, 2, 3].includes(def.priorite), `${nom} : priorité 1 à 3 explicite (jamais 0)`);
  }
  for (const t of ["eleves", "classes", "matieres", "enseignants", "emplois", "appreciations", "ecoles", "postes", "salaires", "tarifs"]) {
    assert.deepEqual(prioriteDe(t), [1], t);
  }
  for (const t of ["notes", "absences"]) assert.deepEqual(prioriteDe(t), [2], t);
  for (const t of ["historique", "livrets", "comptes", "messages", "evenements"]) assert.deepEqual(prioriteDe(t), [3], t);
});

// Une table qui change de bucket disparaît un moment du miroir quand les
// règles sont redéployées (le nouveau bucket n'est pas encore livré alors que
// l'ancien ne la contient plus) — et une saisie à ce moment-là crée un
// doublon. Tout déplacement doit donc être délibéré : mettre à jour ce relevé.
test("contenu des buckets figé (un déplacement de table doit être délibéré)", () => {
  const releve = Object.fromEntries(Object.entries(buckets(compacte)).map(([nom, def]) => [nom, def.tables]));
  assert.deepEqual(releve, {
    school_data: ["eleves", "classes", "matieres", "enseignants", "emplois", "enseignements", "appreciations", "ecoles", "annonces", "postes"],
    teacher_notes: ["notes", "absences"],
    staff_notes: ["notes", "absences"],
    // paiements (journal des encaissements) ajouté le 2026-10-06 : nouvelle
    // table du miroir, aucune autre ne change de bucket.
    // presences (registre des absences du personnel) ajouté le 2026-10-10.
    compta_data: ["recettes", "depenses", "versements", "bons", "personnel", "salaires", "tarifs", "paiements", "presences"],
    calendrier_data: ["evenements"],
    examens_data: ["examens", "livrets", "honneurs"],
    messages_data: ["messages"],
    fondation_data: ["membres", "documents"],
    historique_data: ["historique"],
    admin_data: ["comptes"],
  });
});

test("chaque table du miroir local est synchronisée par au moins un bucket", () => {
  const synchronisees = new Set(Object.values(buckets(compacte)).flatMap((x) => x.tables));
  const manquantes = AppSchema.toJSON().tables.map((t) => t.name).filter((t) => !synchronisees.has(t));
  assert.deepEqual(manquantes, []);
});
