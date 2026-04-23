import assert from "node:assert/strict";
import test from "node:test";
import { getRecuTotals } from "../src/reports.js";

test("getRecuTotals inclut les autres frais et l'inscription quand ils sont réglés", () => {
  const eleve = {
    mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Impayé" },
    inscriptionPayee: true,
    autrePayee: true,
  };

  const totals = getRecuTotals(
    eleve,
    200000,
    ["Octobre", "Novembre", "Décembre"],
    { inscription: 50000, autre: 15000 },
  );

  assert.equal(totals.totalMensualites, 400000);
  assert.equal(totals.fraisIns, 50000);
  assert.equal(totals.fraisAutre, 15000);
  assert.equal(totals.totalGeneral, 465000);
});

test("getRecuTotals n'ajoute pas les frais annexes non réglés", () => {
  const eleve = {
    mens: { Octobre: "Payé" },
    inscriptionPayee: false,
    autrePayee: false,
  };

  const totals = getRecuTotals(
    eleve,
    180000,
    ["Octobre"],
    { inscription: 30000, autre: 10000 },
  );

  assert.equal(totals.totalMensualites, 180000);
  assert.equal(totals.totalGeneral, 180000);
});
