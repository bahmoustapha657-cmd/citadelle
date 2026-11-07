import assert from "node:assert/strict";
import test from "node:test";
import {
  filtrerDepensesParMois, libelleMois, moisDeDepense, moisDesDepenses, totalDepenses,
} from "../src/components/comptabilite/depenses-utils.js";
import { etatDepensesHTML, ficheBonHTML, numeroBon } from "../src/reports/pieces-depenses.js";
import { signatairesDocument } from "../src/reports/signatures.js";

const ecole = { nom: "La Citadelle", ville: "Conakry", monnaie: "GNF" };

const depenses = [
  { _id: "d3", libelle: "Craie", categorie: "Matériel", montant: 150000, date: "2026-11-03", periode: "T1" },
  { _id: "d1", libelle: "Électricité", categorie: "Charges", montant: 400000, date: "2026-10-20", periode: "T1" },
  { _id: "d2", libelle: "Peinture", categorie: "Infrastructure", montant: 1000000, date: "2026-10-05", periode: "T1" },
  { _id: "d0", libelle: "Ancienne <saisie>", categorie: "Divers", montant: 50000, date: "" },
];

test("les dépenses se rangent par mois de leur date", () => {
  assert.equal(moisDeDepense({ date: "2026-10-20" }), "2026-10");
  assert.equal(moisDeDepense({ date: "" }), "");
  assert.equal(moisDeDepense({ date: "2026-13-01" }), "");
  assert.deepEqual(moisDesDepenses(depenses), ["2026-10", "2026-11"]);
  assert.equal(libelleMois("2026-10"), "Octobre 2026");
  assert.equal(libelleMois(""), "");
});

test("le filtre d'un mois ne garde que ses dépenses, triées par date", () => {
  assert.deepEqual(filtrerDepensesParMois(depenses, "2026-10").map((d) => d._id), ["d2", "d1"]);
  // État global : tout, la dépense sans date en dernier.
  assert.deepEqual(filtrerDepensesParMois(depenses, "").map((d) => d._id), ["d2", "d1", "d3", "d0"]);
  assert.equal(totalDepenses(filtrerDepensesParMois(depenses, "2026-10")), 1400000);
});

test("l'état mensuel des dépenses porte le mois, le total en lettres et les signatures", () => {
  const html = etatDepensesHTML({
    depenses: filtrerDepensesParMois(depenses, "2026-10"), schoolInfo: ecole, annee: "2026-2027", mois: "2026-10",
  });
  assert.match(html, /ÉTAT DES DÉPENSES/);
  assert.match(html, /MOIS D.OCTOBRE 2026/);
  assert.match(html, /Un million quatre cent mille francs guinéens/);
  assert.match(html, /Le Comptable/);
  assert.match(html, /Le Directeur/);
  assert.doesNotMatch(html, /Récapitulatif par mois/);
  assert.doesNotMatch(html, /Craie/);
});

test("l'état global récapitule par mois et échappe les saisies", () => {
  const html = etatDepensesHTML({ depenses: filtrerDepensesParMois(depenses, ""), schoolInfo: ecole, annee: "2026-2027" });
  assert.match(html, /ÉTAT GLOBAL/);
  assert.match(html, /Récapitulatif par mois/);
  assert.match(html, /Novembre 2026/);
  assert.match(html, /Sans date/);
  assert.match(html, /Ancienne &lt;saisie&gt;/);
  assert.doesNotMatch(html, /<saisie>/);
});

test("la fiche de bon sort en deux exemplaires à signer par le bénéficiaire", () => {
  const bon = { _id: "8f2c-41ab-9d7e", nom: "Mamadou Diallo", section: "Secondaire", mois: "Octobre", montant: 250000, motif: "Avance", date: "2026-10-12" };
  const html = ficheBonHTML({ bon, schoolInfo: ecole, annee: "2026-2027" });
  assert.equal(numeroBon(bon), "AB9D7E");
  assert.equal((html.match(/<section class="bon">/g) || []).length, 2);
  assert.match(html, /Exemplaire de l'école/);
  assert.match(html, /Exemplaire du bénéficiaire/);
  assert.match(html, /BON N° AB9D7E/);
  assert.match(html, /Deux cent cinquante mille francs guinéens/);
  assert.match(html, /Lu et approuvé/);
  assert.match(html, /Le Comptable/);
  assert.match(html, /12\/10\/2026/);
});

test("un ancien bon sans date prend la date du jour, et chaque exemplaire porte le filigrane", () => {
  const html = ficheBonHTML({ bon: { _id: "x1", nom: "A", montant: 1000 }, schoolInfo: { ...ecole, logo: "https://ex.test/logo.png" } });
  assert.match(html, new RegExp(`le ${new Date().toLocaleDateString("fr-FR").replace(/\//g, "\\/")}`));
  assert.doesNotMatch(html, /……\/……/);
  assert.equal((html.match(/class="bon-filigrane"/g) || []).length, 2);
});

test("l'état des dépenses porte le logo en filigrane", () => {
  const html = etatDepensesHTML({ depenses, schoolInfo: { ...ecole, logo: "https://ex.test/logo.png" } });
  assert.match(html, /class="lc-watermark"/);
});

test("fiche de bon et état des dépenses sont réglables dans « Qui signe quoi »", () => {
  for (const doc of ["bon", "depenses"]) {
    assert.deepEqual(signatairesDocument(ecole, doc, { signataire: null }).map((s) => s.cle), ["comptable", "direction"]);
  }
});
