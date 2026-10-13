import assert from "node:assert/strict";
import test from "node:test";
import {
  affichageFinancesClassique, montantAxe, syntheseFinances,
} from "../src/components/comptabilite/finances-claires.js";

const overview = {
  totalDu: 1_000_000, totalPercu: 600_000,
  totalInscriptionsPercues: 200_000, totalAutresPercus: 50_000,
  totalResteInscriptions: 100_000, totalResteAutres: 25_000,
  totalPayes: 6, totalImpayes: 4, totalPartiels: 1,
  totalExonere: 30_000, totalElevesExoneres: 1,
};

test("le solde compte la scolarité encaissée, pas seulement les recettes saisies", () => {
  const s = syntheseFinances({
    overview,
    recettes: [{ montant: 10_000 }],
    depenses: [{ montant: "40000" }],
    versements: [{ montant: 300_000 }],
  });
  assert.equal(s.totalEntrees, 600_000 + 200_000 + 50_000 + 10_000);
  // Les versements (banque / Fondation) SORTENT de la caisse.
  assert.equal(s.totalSorties, 40_000 + 300_000);
  assert.equal(s.solde, 860_000 - 340_000);
  assert.deepEqual(s.entrees.map((l) => l.id), ["scolarite", "inscription", "frais", "recette"]);
  assert.deepEqual(s.sorties.map((l) => l.id), ["depense", "versement"]);
});

test("le reste à encaisser couvre mensualités, inscriptions et frais annexes", () => {
  const { recouvrement: r } = syntheseFinances({ overview });
  assert.equal(r.reste, 400_000 + 100_000 + 25_000);
  assert.equal(r.encaisse, 850_000);
  assert.equal(r.attendu, 850_000 + 525_000);
  assert.ok(Math.abs(r.taux - (850_000 / 1_375_000) * 100) < 1e-9);
  assert.equal(r.exonere, 30_000);
});

test("sans données : tout à zéro, aucun NaN", () => {
  const s = syntheseFinances({});
  assert.equal(s.solde, 0);
  assert.equal(s.recouvrement.taux, 0);
  assert.equal(s.recouvrement.reste, 0);
});

test("La Citadelle garde l'affichage d'origine, les autres écoles passent au lisible", () => {
  assert.equal(affichageFinancesClassique("citadelle"), true);
  assert.equal(affichageFinancesClassique("autre-ecole"), false);
  assert.equal(affichageFinancesClassique(undefined), false);
});

test("graduations d'axe en français compact", () => {
  assert.match(montantAxe(1_200_000), /^1,2\sM$/);
  assert.equal(montantAxe(0), "0");
});
