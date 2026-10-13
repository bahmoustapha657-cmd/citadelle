import assert from "node:assert/strict";
import test from "node:test";
import {
  filtrerPeriode, libellePeriode, periodesCaisse, serieParMois, totauxMouvements,
} from "../src/components/comptabilite/caisse/caisse-utils.js";

const jour = (a, m, j) => new Date(a, m - 1, j);
const cleMois = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

test("l'aperçu annuel compte les réinscriptions de septembre de l'année consultée", () => {
  // Année 2026-2027, école passée à la nouvelle année en septembre : ses
  // encaissements de septembre 2026 sont enregistrés dans 2026-2027.
  const mvts = [
    { date: jour(2026, 9, 15), sens: "entree", montant: 500 },
    { date: jour(2026, 10, 2), sens: "entree", montant: 100 },
    { date: jour(2027, 6, 30), sens: "sortie", montant: 40 },
  ];
  const serie = serieParMois(mvts, "2026-2027");
  assert.equal(serie.length, 12);
  assert.equal(cleMois(serie[0].date), "2026-09");
  assert.equal(cleMois(serie[11].date), "2027-08");
  assert.equal(serie[0].entrees, 500);
  assert.equal(serie[1].entrees, 100);
  assert.equal(serie[9].sorties, 40); // juin 2027
});

test("un mois hors de septembre → août ajoute sa barre : la somme des barres égale les totaux", () => {
  const mvts = [
    { date: jour(2026, 7, 20), sens: "entree", montant: 300 }, // pré-inscription de l'été
    { date: jour(2026, 9, 1), sens: "entree", montant: 200 },
    { date: jour(2024, 3, 5), sens: "sortie", montant: 70 }, // date mal saisie
    { date: jour(2026, 11, 3), sens: "neutre", montant: 999 }, // erreur de saisie corrigée
  ];
  const serie = serieParMois(mvts, "2026-2027");
  assert.deepEqual(serie.slice(0, 3).map((m) => cleMois(m.date)), ["2024-03", "2026-07", "2026-09"]);
  assert.equal(serie.length, 14);
  const totaux = totauxMouvements(mvts);
  assert.equal(serie.reduce((s, m) => s + m.entrees, 0), totaux.entrees);
  assert.equal(serie.reduce((s, m) => s + m.sorties, 0), totaux.sorties);
  // Année illisible : seulement les mois qui portent un mouvement.
  assert.equal(serieParMois(mvts, "").length, 4);
});

test("journée / semaine / mois filtrent toujours par date", () => {
  const mvts = [
    { date: jour(2026, 9, 30), sens: "entree", montant: 1 },
    { date: jour(2026, 10, 1), sens: "entree", montant: 2 },
  ];
  assert.equal(filtrerPeriode(mvts, jour(2026, 9, 10), "mois").length, 1);
  assert.equal(filtrerPeriode(mvts, jour(2026, 10, 1), "jour").length, 1);
  assert.equal(libellePeriode(jour(2026, 9, 10), "mois"), "Septembre 2026");
});

test("l'aperçu annuel est masqué pour La Citadelle seulement", () => {
  assert.ok(!periodesCaisse("citadelle").some((p) => p.id === "annee"));
  assert.ok(periodesCaisse("autre-ecole").some((p) => p.id === "annee"));
  assert.equal(periodesCaisse("citadelle").length, 3);
});
