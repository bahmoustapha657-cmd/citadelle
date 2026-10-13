import assert from "node:assert/strict";
import test from "node:test";
import {
  anneeScolaireDe, bornesPeriode, decalerPeriode, filtrerPeriode, libellePeriode,
  periodesCaisse, serieParMois,
} from "../src/components/comptabilite/caisse/caisse-utils.js";

const jour = (a, m, j) => new Date(a, m - 1, j);

test("l'année scolaire couvre douze mois à partir du mois de rentrée", () => {
  const { debut, fin, ouverture } = anneeScolaireDe(jour(2027, 2, 14), "Octobre");
  assert.equal(ouverture, 2026);
  assert.deepEqual(debut, jour(2026, 10, 1));
  assert.deepEqual(fin, jour(2027, 9, 30));
  // Vacances : août appartient à l'année qui se termine.
  assert.equal(anneeScolaireDe(jour(2027, 8, 20), "Octobre").ouverture, 2026);
  assert.equal(anneeScolaireDe(jour(2026, 10, 1), "Octobre").ouverture, 2026);
  assert.equal(anneeScolaireDe(jour(2026, 9, 30), "Octobre").ouverture, 2025);
  // Rentrée en septembre.
  assert.deepEqual(bornesPeriode(jour(2026, 9, 3), "annee", "Septembre"),
    { debut: jour(2026, 9, 1), fin: jour(2027, 8, 31) });
});

test("navigation, libellé et filtrage de la période Année", () => {
  assert.equal(libellePeriode(jour(2027, 3, 1), "annee", "Octobre"), "Année scolaire 2026-2027");
  assert.equal(anneeScolaireDe(decalerPeriode(jour(2027, 3, 31), "annee", -1), "Octobre").ouverture, 2025);
  const mvts = [
    { date: jour(2026, 9, 30), sens: "entree", montant: 1 },
    { date: jour(2026, 10, 1), sens: "entree", montant: 100 },
    { date: jour(2027, 9, 30), sens: "sortie", montant: 40 },
  ];
  assert.equal(filtrerPeriode(mvts, jour(2027, 1, 1), "annee", "Octobre").length, 2);
  const serie = serieParMois(mvts.slice(1), jour(2027, 1, 1), "Octobre");
  assert.equal(serie.length, 12);
  assert.equal(serie[0].entrees, 100);
  assert.equal(serie[11].sorties, 40);
});

test("l'aperçu annuel est masqué pour La Citadelle seulement", () => {
  assert.ok(!periodesCaisse("citadelle").some((p) => p.id === "annee"));
  assert.ok(periodesCaisse("autre-ecole").some((p) => p.id === "annee"));
  assert.equal(periodesCaisse("citadelle").length, 3);
});
