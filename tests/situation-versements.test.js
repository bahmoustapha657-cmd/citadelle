import assert from "node:assert/strict";
import test from "node:test";
import { montantEnLettres, nombreEnLettres } from "../src/reports/montant-lettres.js";
import {
  filtrerVersements, libellePeriodeVersements, resumeVersements,
} from "../src/components/comptabilite/fondation/versements-utils.js";
import { situationVersementsHTML } from "../src/reports/situation-versements.js";
import { collecterMouvements, totauxMouvements } from "../src/components/comptabilite/caisse/caisse-utils.js";
import { signatairesDocument } from "../src/reports/signatures.js";

// ── Montant en lettres ────────────────────────────────────────────────────
test("les nombres s'écrivent en lettres selon l'orthographe traditionnelle", () => {
  const cas = {
    0: "zéro", 1: "un", 16: "seize", 17: "dix-sept", 21: "vingt et un", 22: "vingt-deux",
    61: "soixante et un", 70: "soixante-dix", 71: "soixante et onze", 77: "soixante-dix-sept",
    80: "quatre-vingts", 81: "quatre-vingt-un", 90: "quatre-vingt-dix", 91: "quatre-vingt-onze",
    99: "quatre-vingt-dix-neuf", 100: "cent", 101: "cent un", 200: "deux cents", 201: "deux cent un",
    280: "deux cent quatre-vingts", 1000: "mille", 1001: "mille un", 2000: "deux mille",
    21000: "vingt et un mille", 80000: "quatre-vingt mille", 200000: "deux cent mille",
    1000000: "un million", 2500000: "deux millions cinq cent mille",
    200000000: "deux cents millions", 80000000: "quatre-vingts millions",
    1250000000: "un milliard deux cent cinquante millions",
  };
  for (const [n, attendu] of Object.entries(cas)) assert.equal(nombreEnLettres(Number(n)), attendu, n);
});

test("le montant en lettres porte la monnaie de l'école", () => {
  assert.equal(montantEnLettres(5200000, "GNF"), "Cinq millions deux cent mille francs guinéens");
  assert.equal(montantEnLettres(150000, "XOF"), "Cent cinquante mille francs CFA");
  assert.equal(montantEnLettres(12, "ABC"), "Douze ABC");
});

// ── Filtres et totaux ─────────────────────────────────────────────────────
const versements = [
  { _id: "v3", libelle: "Dépôt novembre", montant: 3000000, date: "2026-11-05", beneficiaire: "Banque", reference: "BRD-778" },
  { _id: "v1", libelle: "Remise fondateur", montant: 1500000, date: "2026-10-02", beneficiaire: "Fondation" },
  { _id: "v2", libelle: "Dépôt octobre", montant: 2000000, date: "2026-10-28", beneficiaire: "Banque" },
  { _id: "v0", libelle: "Ancien versement", montant: 500000, date: "" },
];

test("sans filtre, tous les versements sortent, du plus ancien au plus récent", () => {
  assert.deepEqual(filtrerVersements(versements).map((v) => v._id), ["v1", "v2", "v3", "v0"]);
});

test("la période et le bénéficiaire filtrent, bornes incluses", () => {
  assert.deepEqual(filtrerVersements(versements, { du: "2026-10-01", au: "2026-10-31" }).map((v) => v._id), ["v1", "v2"]);
  assert.deepEqual(filtrerVersements(versements, { au: "2026-10-02" }).map((v) => v._id), ["v1"]);
  assert.deepEqual(filtrerVersements(versements, { beneficiaire: "Banque" }).map((v) => v._id), ["v2", "v3"]);
  // Un versement sans date ne tombe dans aucune période.
  assert.ok(!filtrerVersements(versements, { du: "2020-01-01" }).some((v) => v._id === "v0"));
});

test("le résumé détaille les montants par bénéficiaire", () => {
  const r = resumeVersements(versements);
  assert.equal(r.total, 7000000);
  assert.equal(r.nb, 4);
  assert.deepEqual(r.parBeneficiaire, [
    { beneficiaire: "Banque", total: 5000000, nb: 2 },
    { beneficiaire: "Fondation", total: 1500000, nb: 1 },
    { beneficiaire: "Non précisé", total: 500000, nb: 1 },
  ]);
  assert.equal(libellePeriodeVersements({ du: "2026-10-01", au: "2026-10-31" }), "Du 01/10/2026 au 31/10/2026");
  assert.equal(libellePeriodeVersements({}), "");
});

// ── Document imprimé ──────────────────────────────────────────────────────
const ecole = {
  nom: "La Citadelle", ville: "Kindia", monnaie: "GNF",
  responsables: { comptable: "Aïssatou Bah", direction: "Mamadou Lamarana Diallo" },
};

test("la situation liste les versements, le total en chiffres et en lettres, et les signataires", () => {
  const liste = filtrerVersements(versements, { beneficiaire: "Banque" });
  const html = situationVersementsHTML({ versements: liste, schoolInfo: ecole, annee: "2026-2027", beneficiaire: "Banque" });
  assert.match(html, /SITUATION DES VERSEMENTS/);
  assert.match(html, /ANNÉE SCOLAIRE 2026-2027/);
  assert.match(html, /Bénéficiaire : Banque/);
  assert.match(html, /BRD-778/);
  assert.match(html, /28\/10\/2026/);
  assert.match(html, /Cinq millions francs guinéens/);
  // Comptable et visa de la Direction (matrice), puis « Pour réception ».
  assert.match(html, /Le Comptable<br\/><span[^>]*>Aïssatou Bah/);
  assert.match(html, /Le Directeur<br\/><span[^>]*>Mamadou Lamarana Diallo/);
  assert.match(html, /Pour réception/);
});

test("un seul versement s'imprime au singulier", () => {
  const html = situationVersementsHTML({ versements: [versements[0]], schoolInfo: ecole, annee: "2026-2027" });
  assert.match(html, /SITUATION DE VERSEMENT</);
  assert.match(html, /Trois millions francs guinéens/);
});

test("les saisies libres sont échappées dans le document", () => {
  const html = situationVersementsHTML({
    versements: [{ _id: "x", libelle: "<script>alert(1)</script>", description: "A & B", montant: 10, date: "2026-10-01" }],
    schoolInfo: ecole,
  });
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
});

test("la matrice des signatures connaît la situation des versements", () => {
  const [principal, visa] = signatairesDocument(ecole, "versements", { signataire: null });
  assert.equal(principal.cle, "comptable");
  assert.equal(visa.cle, "direction");
});

// ── Caisse ────────────────────────────────────────────────────────────────
test("un versement à la banque ou à la Fondation SORT de la caisse", () => {
  const mouvements = collecterMouvements({
    recettes: [{ _id: "r1", libelle: "Cantine", montant: 400000, date: "2026-10-02" }],
    versements: [{ _id: "v1", libelle: "Dépôt", montant: 300000, date: "2026-10-02", beneficiaire: "Banque" }],
    eleves: [], moisAnnee: [], tarifsClasses: [], paiements: [],
  });
  const versement = mouvements.find((m) => m.id === "versement-v1");
  assert.equal(versement.sens, "sortie");
  assert.equal(versement.source, "versement");
  assert.match(versement.detail, /Banque/);
  const totaux = totauxMouvements(mouvements);
  assert.equal(totaux.entrees, 400000);
  assert.equal(totaux.sorties, 300000);
  assert.equal(totaux.solde, 100000);
});
