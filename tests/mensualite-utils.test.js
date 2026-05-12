import assert from "node:assert/strict";
import test from "node:test";

import {
  MENSUALITE_ALGO_VERSION,
  countPaidMonths,
  countUnpaidMonths,
  getConsecutiveUnpaidMonths,
  getEleveMensualiteSnapshot,
  getEleveSolde,
  getElevesCritiques,
  getMensualiteOverview,
  getTarifAutreForClasse,
  getTarifBaseForClasse,
  getTarifInscriptionForEleve,
  getTarifMensuelForClasse,
  getTarifReinscriptionForClasse,
  getTarifRevisionForClasse,
  isEleveCritique,
} from "../src/mensualite-utils.js";

test("tarif helpers expose monthly, revision, other and reinscription values", () => {
  const tarifs = [{
    classe: "6e A",
    montant: 180000,
    revision: 20000,
    autre: 15000,
    inscription: 50000,
    reinscription: 30000,
  }];

  assert.equal(getTarifBaseForClasse(tarifs, "6e A"), 180000);
  assert.equal(getTarifRevisionForClasse(tarifs, "6e A"), 20000);
  assert.equal(getTarifAutreForClasse(tarifs, "6e A"), 15000);
  assert.equal(getTarifMensuelForClasse(tarifs, "6e A"), 200000);
  assert.equal(getTarifReinscriptionForClasse(tarifs, "6e A"), 30000);
});

test("getTarifInscriptionForEleve distinguishes inscription and reinscription", () => {
  const tarifs = [{
    classe: "6e A",
    inscription: 50000,
    reinscription: 30000,
  }];

  assert.equal(getTarifInscriptionForEleve({ classe: "6e A", typeInscription: "Première inscription" }, tarifs), 50000);
  assert.equal(getTarifInscriptionForEleve({ classe: "6e A", typeInscription: "Réinscription" }, tarifs), 30000);
});

test("monthly counters and critical detection use the school-month model", () => {
  const eleve = {
    mens: {
      Octobre: "Payé",
      Novembre: "Impayé",
      Décembre: "Impayé",
      Janvier: "Impayé",
    },
  };
  const moisAnnee = ["Octobre", "Novembre", "Décembre", "Janvier"];

  assert.equal(countPaidMonths(eleve, moisAnnee), 1);
  assert.equal(countUnpaidMonths(eleve, moisAnnee), 3);
  assert.equal(getConsecutiveUnpaidMonths(eleve, moisAnnee), 3);
  assert.equal(isEleveCritique(eleve, moisAnnee, 3), true);
});

test("snapshot and overview aggregate scolarite and one-time fees", () => {
  const moisAnnee = ["Octobre", "Novembre", "Décembre"];
  const tarifs = [{
    classe: "6e A",
    montant: 180000,
    revision: 20000,
    autre: 15000,
    inscription: 50000,
    reinscription: 30000,
  }];
  const eleves = [
    {
      classe: "6e A",
      typeInscription: "Première inscription",
      mens: { Octobre: "Payé", Novembre: "Impayé", Décembre: "Payé" },
      inscriptionPayee: true,
      autrePayee: true,
    },
    {
      classe: "6e A",
      typeInscription: "Réinscription",
      mens: { Octobre: "Impayé", Novembre: "Impayé", Décembre: "Impayé" },
      inscriptionPayee: false,
      autrePayee: false,
    },
  ];

  const snapshot = getEleveMensualiteSnapshot(eleves[0], moisAnnee, tarifs);
  assert.deepEqual(snapshot, {
    algoVersion: MENSUALITE_ALGO_VERSION,
    nbPayes: 2,
    nbImpayes: 1,
    montantMensualitesPercu: 400000,
    montantInscriptionPercu: 50000,
    montantAutrePercu: 15000,
    soldeMensualites: 200000,
    soldeInscription: 0,
    soldeAutre: 0,
  });

  const overview = getMensualiteOverview(eleves, moisAnnee, tarifs);
  assert.deepEqual(overview, {
    totalDu: 1200000,
    totalPercu: 400000,
    totalPayes: 2,
    totalImpayes: 4,
    totalInscriptionsPercues: 50000,
    totalAutresPercus: 15000,
  });
});

test("getEleveSolde sums unpaid months, unpaid inscription and unpaid other fees", () => {
  const moisAnnee = ["Octobre", "Novembre", "Décembre"];
  const tarifs = [{
    classe: "6e A",
    montant: 180000,
    revision: 20000,
    autre: 15000,
    inscription: 50000,
    reinscription: 30000,
  }];

  // Élève à jour partout
  const ok = {
    classe: "6e A",
    typeInscription: "Première inscription",
    mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Payé" },
    inscriptionPayee: true,
    autrePayee: true,
  };
  assert.equal(getEleveSolde(ok, moisAnnee, tarifs), 0);

  // Élève rien payé
  const debiteur = {
    classe: "6e A",
    typeInscription: "Réinscription",
    mens: { Octobre: "Impayé", Novembre: "Impayé", Décembre: "Impayé" },
    inscriptionPayee: false,
    autrePayee: false,
  };
  // 3 * 200000 (mensualité) + 30000 (réinscription) + 15000 (autre) = 645000
  assert.equal(getEleveSolde(debiteur, moisAnnee, tarifs), 645000);

  // Cas mixte : 1 mois impayé, inscription payée, autre impayé
  const mixte = {
    classe: "6e A",
    typeInscription: "Première inscription",
    mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Impayé" },
    inscriptionPayee: true,
    autrePayee: false,
  };
  // 1 * 200000 + 0 (inscription payée) + 15000 (autre impayé) = 215000
  assert.equal(getEleveSolde(mixte, moisAnnee, tarifs), 215000);
});

test("MENSUALITE_ALGO_VERSION est un entier ≥ 1 (canari pour repérer les bumps non documentés)", () => {
  assert.equal(typeof MENSUALITE_ALGO_VERSION, "number");
  assert.equal(MENSUALITE_ALGO_VERSION, 1);
});

test("getElevesCritiques returns only students with enough consecutive unpaid months", () => {
  const moisAnnee = ["Octobre", "Novembre", "Décembre"];
  const eleves = [
    { _id: "1", mens: { Octobre: "Payé", Novembre: "Impayé", Décembre: "Impayé" } },
    { _id: "2", mens: { Octobre: "Impayé", Novembre: "Impayé", Décembre: "Impayé" } },
  ];

  const critiques = getElevesCritiques(eleves, moisAnnee, 3);
  assert.deepEqual(critiques.map((eleve) => eleve._id), ["2"]);
});

