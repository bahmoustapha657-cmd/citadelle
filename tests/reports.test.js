import assert from "node:assert/strict";
import test from "node:test";
import { getRecuTotals } from "../src/reports.js";
import { responsableNom, signataireHTML } from "../src/reports/print-helpers.js";

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

test("signataireHTML affiche le responsable du poste sous le titre", () => {
  const schoolInfo = { responsables: { comptable: "Mamadou Diallo", direction: "  Aïssatou Bah  " } };
  assert.equal(responsableNom(schoolInfo, "comptable"), "Mamadou Diallo");
  assert.equal(responsableNom(schoolInfo, "direction"), "Aïssatou Bah");
  assert.equal(responsableNom(schoolInfo, "surveillant"), "");
  assert.equal(responsableNom({}, "comptable"), "");

  const html = signataireHTML(schoolInfo, "comptable", "Le Comptable");
  assert.ok(html.startsWith("Le Comptable<br/>"));
  assert.ok(html.includes("Mamadou Diallo"));
  // Sans responsable renseigné : titre seul, rendu historique inchangé.
  assert.equal(signataireHTML(schoolInfo, "surveillant", "Le Surveillant"), "Le Surveillant");
  assert.equal(signataireHTML(undefined, "direction", "Le Directeur"), "Le Directeur");
});

test("getRecuTotals utilise les montants figés au paiement (v2), repli tarif courant", () => {
  const eleve = {
    mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Payé" },
    // Octobre et Novembre encaissés à l'ancien tarif ; Décembre payé avant la
    // v2 (pas de montant figé) → tarif courant.
    mensMontants: { Octobre: 150000, Novembre: 150000 },
    inscriptionPayee: false,
    autrePayee: false,
  };

  const totals = getRecuTotals(
    eleve,
    200000,
    ["Octobre", "Novembre", "Décembre"],
    {},
  );

  assert.equal(totals.totalMensualites, 150000 + 150000 + 200000);
  assert.equal(totals.totalGeneral, 500000);
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
