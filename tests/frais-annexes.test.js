import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGUE_FRAIS_ANNEXES,
  getFraisAnnexeDate,
  getFraisAnnexeLabel,
  getTarifFraisAnnexes,
  getTarifFraisDivers,
  isFraisAnnexePaye,
} from "../src/constants.js";
import { buildTarifData, normalizeFraisDivers } from "../src/components/comptabilite/compta-tarifs.js";
import { getEleveMensualiteSnapshot, getEleveSolde } from "../src/mensualite-utils.js";
import { getRecuTotals } from "../src/reports.js";

test("catalogue : autre + frais usuels (uniforme, cantine, transport, examens…)", () => {
  const ids = CATALOGUE_FRAIS_ANNEXES.map((f) => f.id);
  for (const attendu of ["autre", "uniforme", "fournitures", "cantine", "transport", "examens", "assurance"]) {
    assert.ok(ids.includes(attendu), `catalogue doit contenir ${attendu}`);
  }
  assert.equal(getFraisAnnexeLabel("cantine"), "Cantine");
  assert.equal(getFraisAnnexeLabel("inconnu"), "inconnu");
});

test("getTarifFraisDivers : montants > 0 du catalogue seulement, jamais « autre »", () => {
  const tarif = { fraisDivers: { uniforme: 50000, cantine: 0, autre: 99999, bidon: 1000 }, autre: 15000 };
  assert.deepEqual(getTarifFraisDivers(tarif), { uniforme: 50000 });
  // « autre » rejoint la carte complète via sa colonne legacy.
  assert.deepEqual(getTarifFraisAnnexes(tarif), { uniforme: 50000, autre: 15000 });
  assert.deepEqual(getTarifFraisDivers({}), {});
});

test("isFraisAnnexePaye / date : legacy « autre » + carte fraisPayes", () => {
  const eleve = { autrePayee: true, autreDate: "01/10/2025", fraisPayes: { uniforme: "02/10/2025" } };
  assert.equal(isFraisAnnexePaye(eleve, "autre"), true);
  assert.equal(isFraisAnnexePaye(eleve, "uniforme"), true);
  assert.equal(isFraisAnnexePaye(eleve, "cantine"), false);
  assert.equal(getFraisAnnexeDate(eleve, "autre"), "01/10/2025");
  assert.equal(getFraisAnnexeDate(eleve, "uniforme"), "02/10/2025");
  assert.equal(isFraisAnnexePaye({}, "autre"), false);
});

test("buildTarifData : fraisDivers normalisés (0 conservé = désactivation), null = intact", () => {
  const data = buildTarifData(100000, { fraisDivers: { uniforme: "50000", cantine: "", transport: 0, bidon: 42 } });
  assert.deepEqual(data.fraisDivers, { uniforme: 50000, transport: 0 });
  assert.equal(buildTarifData(100000, {}).fraisDivers, undefined);
  assert.deepEqual(normalizeFraisDivers({ autre: 5000 }), {});
});

test("snapshot & solde : les frais du catalogue comptent en perçu et en dû", () => {
  const tarifs = [{ classe: "7ème Année A", montant: 100000, autre: 10000, fraisDivers: { uniforme: 50000, cantine: 30000 } }];
  const eleve = {
    classe: "7ème Année A",
    mens: { Oct: "Payé" },
    autrePayee: true,
    fraisPayes: { uniforme: "02/10/2025" }, // cantine impayée
  };
  const snap = getEleveMensualiteSnapshot(eleve, ["Oct", "Nov"], tarifs);
  assert.equal(snap.montantAutrePercu, 10000 + 50000); // autre + uniforme
  assert.equal(snap.soldeAutre, 30000);                // cantine restante
  // Solde total = 1 mois impayé + inscription (0) + cantine.
  assert.equal(getEleveSolde(eleve, ["Oct", "Nov"], tarifs), 100000 + 30000);
});

test("getRecuTotals : les frais divers payés font des lignes et gonflent le total", () => {
  const eleve = {
    mens: { Octobre: "Payé" },
    inscriptionPayee: false,
    autrePayee: false,
    fraisPayes: { uniforme: "02/10/2025" },
  };
  const totals = getRecuTotals(eleve, 100000, ["Octobre"], {
    inscription: 30000, autre: 10000,
    divers: { uniforme: 50000, cantine: 30000 },
  });
  assert.deepEqual(totals.fraisDiversPayes, [{ id: "uniforme", label: "Tenue / Uniforme", montant: 50000 }]);
  assert.equal(totals.totalGeneral, 100000 + 50000); // cantine impayée exclue
});
