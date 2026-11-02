import assert from "node:assert/strict";
import test from "node:test";
import {
  figerReglages,
  matieresPourAnnee,
  reglagesAnneesApresCloture,
  reglagesDeLAnnee,
  schoolInfoPourAnnee,
} from "../src/reglages-annee.js";

const ECOLE = {
  nom: "La Citadelle",
  anneeScolaire: "2026-2027",
  periodicitePrimaire: "trimestre",
  periodiciteSecondaire: "semestre",
  modeleBulletin: "prestige",
  evaluationForms: { primaire: [{ value: "Devoir", active: true }] },
};

const calcul = (coefficient) => ({ _id: "m1", nom: "Calcul écrit", coefficient, classes: [], createdAt: 1, updatedAt: 2 });

test("figerReglages : réglages d'évaluation et matières de chaque section, sans horodatage", () => {
  const snap = figerReglages(ECOLE, { primaire: [calcul(2)] }, new Date("2026-07-01T00:00:00Z"));
  assert.equal(snap.figesLe, "2026-07-01T00:00:00.000Z");
  assert.deepEqual(snap.ecole, {
    periodicitePrimaire: "trimestre",
    periodiciteSecondaire: "semestre",
    evaluationForms: ECOLE.evaluationForms,
    modeleBulletin: "prestige",
  });
  assert.equal(snap.ecole.nom, undefined, "l'identité de l'école n'est pas un réglage d'année");
  assert.deepEqual(snap.matieres.primaire, [{ _id: "m1", nom: "Calcul écrit", coefficient: 2, classes: [] }]);
  assert.deepEqual(snap.matieres.college, [], "section sans matière : liste vide");
});

test("année close : ses matières et ses réglages, pas ceux du jour", () => {
  const info = {
    ...ECOLE,
    reglagesAnnees: {
      "2025-2026": {
        ecole: { modeleBulletin: "classique", periodiciteSecondaire: "trimestre" },
        matieres: { primaire: [calcul(2)], college: [] },
      },
    },
  };
  const duJour = [calcul(1), { _id: "m2", nom: "Mesure", coefficient: 1, classes: [] }];
  assert.deepEqual(matieresPourAnnee(duJour, info, "2025-2026", "primaire").map((m) => m.coefficient), [2]);
  assert.deepEqual(matieresPourAnnee(duJour, info, "2025-2026", "lycee"), [],
    "section absente de l'instantané : pas de matières cette année-là");
  const vue = schoolInfoPourAnnee(info, "2025-2026");
  assert.equal(vue.modeleBulletin, "classique");
  assert.equal(vue.periodiciteSecondaire, "trimestre");
  assert.equal(vue.nom, "La Citadelle");
  // L'année officielle se règle au jour le jour, même si un instantané traîne.
  const avecCourante = { ...info, reglagesAnnees: { ...info.reglagesAnnees, "2026-2027": { ecole: { modeleBulletin: "x" }, matieres: {} } } };
  assert.equal(reglagesDeLAnnee(avecCourante, "2026-2027"), null);
  assert.equal(matieresPourAnnee(duJour, avecCourante, "2026-2027", "primaire"), duJour);
  assert.equal(schoolInfoPourAnnee(avecCourante, "2026-2027"), avecCourante);
});

test("année close AVANT le mécanisme : réglages du jour, comme avant", () => {
  const duJour = [calcul(1)];
  assert.equal(matieresPourAnnee(duJour, ECOLE, "2024-2025", "primaire"), duJour);
  assert.equal(schoolInfoPourAnnee(ECOLE, "2024-2025"), ECOLE);
});

test("clôture : un instantané existant n'est jamais réécrit", () => {
  const premier = { figesLe: "a", ecole: {}, matieres: {} };
  const second = { figesLe: "b", ecole: {}, matieres: {} };
  const apres = reglagesAnneesApresCloture(ECOLE, "2025-2026", premier);
  assert.deepEqual(apres, { "2025-2026": premier });
  assert.deepEqual(reglagesAnneesApresCloture({ ...ECOLE, reglagesAnnees: apres }, "2025-2026", second), { "2025-2026": premier },
    "une année rouverte puis reclôturée garde les réglages de sa première clôture");
});
