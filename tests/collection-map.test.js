// collection-map : que devient la `section` d'un item à l'écriture ? Deux
// règles opposées selon la table :
//   • table PLATE (salaires, bons, livrets…) : la section est une donnée de
//     l'item et doit survivre. Perdue, la fiche de paie sort des listes par
//     section, la garde anti-doublon ne la retrouve plus et les bons ne
//     s'appliquent plus ;
//   • table SECTIONNÉE (eleves, notes…) : la section vient du NOM de la
//     collection (elevesPrimaire → primaire) et data-supabase l'impose. L'item
//     ne doit jamais pouvoir la choisir.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCollection, toRow, transformRow } from "../src/backend/collection-map.js";
import { buildPrimarySalaryRecord, findBonsForSalary, findSalaryDuplicate } from "../src/salary-utils.js";

// Ce que toRow écrit, relu comme après un insert(...).select("*").
const allerRetour = (table, item) =>
  transformRow(table, { id: "r1", ecole_id: "ec1", ...toRow(table, item).row });

test("salaires : la section de la fiche part dans sa colonne", () => {
  const { row, extraKeys } = toRow("salaires", {
    nom: "Oumou DIALLO", mois: "Octobre", section: "Primaire",
    montantNet: 1500000, montantForfait: 1500000, bon: 0, annee: "2026-2027",
  });
  assert.equal(row.section, "Primaire");
  // Colonne et non jsonb : `details` est étalé à la lecture, un doublon dans
  // le jsonb finirait par contredire la colonne.
  assert.ok(!extraKeys.includes("section"));
  assert.equal(row.details.section, undefined);
});

test("fiche générée : section conservée, la génération suivante ne la recrée pas", () => {
  const calculee = buildPrimarySalaryRecord(
    { prenom: "Oumou", nom: "DIALLO", statut: "Titulaire" },
    { mois: "Octobre", getTeacherMonthlyForfait: () => 1500000 },
  );
  const enBase = allerRetour("salaires", { ...calculee, bon: 0, revision: 0, annee: "2026-2027" });
  assert.equal(enBase.section, "Primaire");
  assert.equal(findSalaryDuplicate(calculee, [enBase])?._id, "r1");
});

test("bons : la section part dans extra et le bon s'applique à la bonne fiche", () => {
  const bon = { nom: "Djiba DIALLO", mois: "Octobre", section: "Personnel", montant: 25000, motif: "Avance", annee: "2026-2027" };
  const { row, extraKeys } = toRow("bons", bon);
  assert.equal(row.extra.section, "Personnel");
  // Mise à jour partielle (modifierChampDoc) : la clé doit être connue comme
  // clé jsonb pour être fusionnée avec l'existant.
  assert.ok(extraKeys.includes("section"));

  const enBase = allerRetour("bons", bon);
  const fiche = { nom: "Djiba DIALLO", mois: "Octobre", section: "Personnel" };
  assert.deepEqual(findBonsForSalary(fiche, [enBase]).map((b) => b._id), ["r1"]);
  // …et pas à la fiche d'une autre section du même agent.
  assert.equal(findBonsForSalary({ ...fiche, section: "Secondaire" }, [enBase]).length, 0);
});

test("livrets : la section de l'élève est conservée (périodes et signataires)", () => {
  const enBase = allerRetour("livrets", {
    eleveId: "e1", eleveNom: "BAH Aïssatou", section: "primaire", numeroLivret: "LIV-26-0001", annees: [],
  });
  assert.equal(enBase.section, "primaire");
});

test("tables plates : les clés techniques restent hors de la ligne", () => {
  const { row } = toRow("salaires", {
    _id: "s1", id: "s1", createdAt: 1, updatedAt: 2, nom: "Oumou DIALLO", section: "Personnel",
  });
  assert.deepEqual(row, { nom: "Oumou DIALLO", section: "Personnel" });
});

test("collection sectionnée : l'item ne peut jamais imposer sa section", () => {
  // Toutes les tables qu'une collection sectionnée peut atteindre.
  const tables = new Set();
  for (const base of ["eleves", "notes", "classes", "ens", "absences", "appreciations"]) {
    for (const sec of ["Prescolaire", "Primaire", "College", "Lycee"]) {
      for (const suffixe of ["", "_absences", "_emplois", "_enseignements", "_matieres"]) {
        const map = resolveCollection(`${base}${sec}${suffixe}`);
        assert.ok(map?.section, `${base}${sec}${suffixe} devrait être sectionnée`);
        tables.add(map.table);
      }
    }
  }
  assert.ok(tables.has("eleves") && tables.has("matieres"));

  for (const table of tables) {
    const { row } = toRow(table, { nom: "X", classe: "CM2 A", section: "lycee" });
    assert.equal(row.section, undefined, `${table} : section écrite par l'item`);
    // Ni par le jsonb : extra est étalé APRÈS la colonne à la lecture et la
    // masquerait.
    assert.equal(row.extra?.section, undefined, `${table} : section glissée dans extra`);
  }
});
