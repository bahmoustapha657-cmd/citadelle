import assert from "node:assert/strict";
import test from "node:test";

import { fmtN } from "../src/constants.js";
import {
  elevesDeLAnnee, ligneDispense, situationDispenses, statsDispenses,
} from "../src/components/comptabilite/mensualites-tab/situation-dispenses.js";
import { situationDispensesHTML } from "../src/reports/situation-dispenses.js";

const MOIS = ["Octobre", "Novembre", "Décembre"];
const ANNEE = "2026-2027";
const TARIFS = [
  { classe: "6e A", montant: 100000, inscription: 50000, autre: 20000 },
  { classe: "6e B", montant: 100000, inscription: 50000 },
  { classe: "1ère Année A", montant: 80000 },
];
// Retrait des non réinscrits en vigueur (1er novembre) : `retire` quitte sa classe.
const ecole = { nom: "École Test", monnaie: "GNF", anneeScolaire: ANNEE };
const opts = { moisAnnee: MOIS, annee: ANNEE, tarifsClasses: TARIFS, schoolInfo: ecole, aujourdhui: new Date("2026-12-10T12:00:00") };
const exo = (champs) => ({ annee: ANNEE, mensualites: 0, inscription: 0, fraisAnnexes: 0, accordeePar: "DG ESSAI", accordeeLe: "2026-10-02", ...champs });

// Dispensé de tout, octobre déjà payé : le manque à gagner ne porte que sur
// ce qui restait dû (novembre, décembre, inscription, frais annexes).
const total = {
  _id: "a", nom: "ESSAI", prenom: "Aminata", classe: "6e A", statut: "Actif",
  mens: { Octobre: "Payé" }, mensMontants: { Octobre: 100000 },
  exoneration: exo({ mensualites: 100, inscription: 100, fraisAnnexes: 100, motif: "orphelin" }),
};
// Moitié des mensualités, rien payé : gardé même si la règle des non
// réinscrits le retirerait (un dispensé est toujours compté).
const moitie = {
  _id: "b", nom: "EXEMPLE", prenom: "Paul", classe: "6e A", statut: "Actif", mens: {},
  exoneration: exo({ mensualites: 50, motif: "personnel", precision: "parent enseignant" }),
};
const normalA = { _id: "c", nom: "FICTIF", prenom: "Marie", classe: "6e A", statut: "Actif", inscriptionPayee: true, mens: {} };
const normalB = { _id: "d", nom: "FICTIF", prenom: "Ali", classe: "6e B", statut: "Actif", inscriptionPayee: true, mens: {} };
const parti = { _id: "e", nom: "ESSAI", prenom: "Parti", classe: "6e B", statut: "Transféré", dateDepart: "2026-09-15", mens: {} };
const retire = { _id: "r", nom: "ESSAI", prenom: "Retiré", classe: "6e B", statut: "Actif", mens: {} };
const primaire = {
  _id: "p", nom: "EXEMPLE", prenom: "Fanta", classe: "1ère Année A", statut: "Actif", inscriptionPayee: true,
  mens: { Octobre: "Payé" }, mensMontants: { Octobre: 80000 },
  exoneration: exo({ mensualites: 100, motif: "fratrie" }),
};

const demande = (champs) => ({ annee: ANNEE, mensualites: 100, motif: "social", demandeePar: "Compta ESSAI", demandeeLe: "2026-11-20", statut: "attente", ...champs });
const college = [
  total, moitie,
  { ...normalA, demandeDispense: demande({ statut: "refusee", refuseePar: "DG ESSAI", refuseeLe: "2026-11-22", motifRefus: "Famille solvable" }) },
  { ...normalB, demandeDispense: demande({}) },
  { ...parti, demandeDispense: demande({ annee: "2025-2026" }) },
  retire,
];
const parSection = { college, primaire: [primaire] };

test("élèves de l'année : partis avant la rentrée et non réinscrits retirés exclus, dispensés toujours gardés", () => {
  const ids = elevesDeLAnnee(college, opts).map((e) => e._id);
  assert.deepEqual(ids, ["a", "b", "c", "d"]);
});

test("ligneDispense : taux, motif et manque à gagner poste par poste", () => {
  const l = ligneDispense(total, opts);
  assert.deepEqual(l.taux, { mensualites: 100, inscription: 100, fraisAnnexes: 100 });
  assert.equal(l.motif, "orphelin");
  // Octobre encaissé n'est pas compté : novembre + décembre.
  assert.deepEqual(l.montants, { mensualites: 200000, inscription: 50000, fraisAnnexes: 20000 });
  assert.equal(l.total, 270000);
  assert.equal(l.moisDispenses, 2);
  assert.equal(l.accordeePar, "DG ESSAI");

  const m = ligneDispense(moitie, opts);
  assert.deepEqual(m.montants, { mensualites: 150000, inscription: 0, fraisAnnexes: 0 });
  assert.equal(m.moisDispenses, 0, "une dispense partielle ne couvre aucun mois entier");
  assert.equal(ligneDispense(normalA, opts), null);
});

test("statsDispenses : par poste (100 % / en partie, taux moyen) et par motif", () => {
  const s = statsDispenses([ligneDispense(total, opts), ligneDispense(moitie, opts)], 4);
  assert.equal(s.effectif, 4);
  assert.equal(s.dispenses, 2);
  assert.equal(s.montant, 420000);
  assert.deepEqual(
    { ...s.parPoste.mensualites, sommeTaux: undefined },
    { eleves: 2, totale: 1, partielle: 1, sommeTaux: undefined, tauxMoyen: 75, montant: 350000 },
  );
  assert.equal(s.parPoste.inscription.eleves, 1);
  assert.equal(s.parPoste.inscription.montant, 50000);
  assert.equal(s.parPoste.fraisAnnexes.totale, 1);
  // À nombre égal, le motif qui coûte le plus d'abord.
  assert.deepEqual(s.parMotif, [
    { motif: "orphelin", eleves: 1, montant: 270000 },
    { motif: "personnel", eleves: 1, montant: 150000 },
  ]);
  assert.equal(statsDispenses([], 10).parPoste.mensualites.tauxMoyen, 0);
});

test("situationDispenses : une section — toutes les classes, groupes dispensés, demandes de l'année", () => {
  const s = situationDispenses(parSection, ["college"], opts);
  assert.equal(s.total.effectif, 4);
  assert.equal(s.total.dispenses, 2);
  const parClasse = Object.fromEntries(s.classes.map((c) => [c.classe, [c.effectif, c.dispenses, c.montant]]));
  assert.deepEqual(parClasse, { "6e A": [3, 2, 420000], "6e B": [1, 0, 0] });
  assert.deepEqual(s.groupes.map((g) => g.classe), ["6e A"]);
  assert.deepEqual(s.groupes[0].lignes.map((l) => l.eleve._id), ["a", "b"]);
  // En attente d'abord, puis refusée ; la demande d'une autre année est ignorée.
  assert.deepEqual(s.demandes.map((d) => [d.eleve._id, d.demande.statut]), [["d", "attente"], ["c", "refusee"]]);
});

test("situationDispenses : toutes les sections — statistiques par section et générales", () => {
  const s = situationDispenses(parSection, ["college", "primaire"], opts);
  assert.equal(s.total.effectif, 5);
  assert.equal(s.total.dispenses, 3);
  assert.equal(s.total.montant, 270000 + 150000 + 160000);
  assert.deepEqual(s.sections.map((x) => [x.section, x.effectif, x.dispenses, x.montant]),
    [["college", 4, 2, 420000], ["primaire", 1, 1, 160000]]);
  assert.deepEqual(s.total.parMotif.map((m) => m.motif), ["orphelin", "fratrie", "personnel"]);
  assert.equal(s.total.parPoste.mensualites.eleves, 3);
  assert.equal(s.total.parPoste.mensualites.totale, 2);
  assert.equal(s.total.moisDispenses, 4);
});

test("situationDispensesHTML : liste par classe, statistiques, demandes, signatures", () => {
  const s = situationDispenses(parSection, ["college", "primaire"], opts);
  const html = situationDispensesHTML(s, { schoolInfo: ecole, annee: ANNEE, perimetre: "Toutes les sections" });
  assert.match(html, /SITUATION DES DISPENSES DE PAIEMENT/);
  assert.match(html, /ESSAI<\/strong>|ESSAI Aminata/);
  assert.ok(html.includes("parent enseignant"), "la précision du motif est imprimée");
  assert.ok(html.includes("6e A — 2 dispensé(s) sur 3 élève(s) (67 %)"));
  assert.ok(html.includes(fmtN(580000)), "total du manque à gagner");
  for (const bloc of ["Vue d'ensemble", "Par poste", "Par motif", "Par section", "Par classe (3)"]) {
    assert.ok(html.includes(bloc), bloc);
  }
  // Taux moyen des mensualités : (100 + 50 + 100) / 3.
  assert.ok(html.includes("83 %"));
  assert.ok(html.includes("DEMANDES DE DISPENSE DE L'ANNÉE (2)"));
  assert.ok(html.includes("Famille solvable"));
  assert.ok(html.includes("Le Comptable") && html.includes("La Direction Générale"));
});

test("ligneDispense : à payer, payé, reste et état des paiements de chaque dispensé", () => {
  // Dispensé de tout, octobre payé avant la dispense : tout payé.
  const t = ligneDispense(total, opts);
  assert.deepEqual(t.paiement.mensualites, { aPayer: 100000, paye: 100000, reste: 0 });
  assert.deepEqual([t.aPayer, t.paye, t.reste, t.moisPayes, t.etat], [100000, 100000, 0, 1, "solde"]);

  // 50 % des mensualités, rien payé au 10 décembre : 3 mois échus à 50 000,
  // plus l'inscription et les frais annexes, non dispensés.
  const m = ligneDispense(moitie, opts);
  assert.deepEqual(m.paiement, {
    mensualites: { aPayer: 150000, paye: 0, reste: 150000 },
    inscription: { aPayer: 50000, paye: 0, reste: 50000 },
    fraisAnnexes: { aPayer: 20000, paye: 0, reste: 20000 },
  });
  assert.deepEqual([m.aPayer, m.paye, m.reste], [220000, 0, 220000]);
  assert.deepEqual([m.moisRetard, m.montantRetard, m.etat], [3, 150000, "retard"]);

  // 50 % des mensualités, octobre et décembre (mois de garantie) payés au
  // 15 octobre : il reste novembre, pas encore échu — à jour.
  const aJour = {
    _id: "j", nom: "FICTIF", prenom: "Awa", classe: "6e B", statut: "Actif", inscriptionPayee: true, inscriptionMontant: 50000,
    mens: { Octobre: "Payé", Décembre: "Payé" }, mensMontants: { Octobre: 50000, Décembre: 50000 },
    exoneration: exo({ mensualites: 50, motif: "fratrie" }),
  };
  const j = ligneDispense(aJour, { ...opts, aujourdhui: new Date("2026-10-15T12:00:00") });
  assert.deepEqual([j.aPayer, j.paye, j.reste, j.moisPayes, j.moisRetard, j.etat], [200000, 150000, 50000, 2, 0, "ajour"]);

  // Dispensé de tout, rien encaissé : rien à payer.
  const rien = { _id: "z", nom: "ESSAI", prenom: "Zéro", classe: "6e B", statut: "Actif", mens: {},
    exoneration: exo({ mensualites: 100, inscription: 100, fraisAnnexes: 100, motif: "orphelin" }) };
  assert.equal(ligneDispense(rien, opts).etat, "rien");
});

test("statsDispenses : ce que paient les dispensés, états et retards", () => {
  const s = statsDispenses([ligneDispense(total, opts), ligneDispense(moitie, opts)], 4);
  assert.deepEqual(s.paiement.mensualites, { aPayer: 250000, paye: 100000, reste: 150000 });
  assert.deepEqual([s.aPayer, s.paye, s.reste], [320000, 100000, 220000]);
  assert.deepEqual(s.etats, { rien: 0, solde: 1, ajour: 0, retard: 1 });
  assert.equal(s.rienPaye, 1, "à payer, rien payé : l'élève à 50 %");
  assert.equal(s.montantRetard, 150000);
  assert.deepEqual(statsDispenses([], 3).etats, { rien: 0, solde: 0, ajour: 0, retard: 0 });
});

test("situationDispensesHTML : à payer / payé / reste par élève, états et paiements dans les statistiques", () => {
  const s = situationDispenses(parSection, ["college", "primaire"], opts);
  // À payer : 100 000 + 220 000 + 80 000 ; payé : 100 000 + 80 000.
  assert.deepEqual([s.total.aPayer, s.total.paye, s.total.reste], [400000, 180000, 220000]);
  const html = situationDispensesHTML(s, { schoolInfo: ecole, annee: ANNEE });
  for (const texte of [
    "✔ Tout payé", `⚠ 3 mois en retard (${fmtN(150000)})`, "Accordée par DG ESSAI le 2026-10-02",
    "Ce que paient les élèves dispensés", "Où en sont les élèves dispensés", "Ont à payer mais n'ont encore rien payé",
    fmtN(400000), fmtN(180000), "45 %",
  ]) {
    assert.ok(html.includes(texte), texte);
  }
});

test("situationDispensesHTML : statistiques seules, sans demandes, une section ; noms échappés", () => {
  const piege = { ...moitie, nom: "<b>ESSAI</b>" };
  const s = situationDispenses({ college: [total, piege, normalA] }, ["college"], opts);
  const avecListe = situationDispensesHTML(s, { schoolInfo: ecole, annee: ANNEE });
  assert.ok(avecListe.includes("&lt;b&gt;ESSAI&lt;/b&gt;"));
  assert.ok(!avecListe.includes("<b>ESSAI</b>"));

  const stats = situationDispensesHTML(s, { detail: "stats", avecDemandes: false, schoolInfo: ecole, annee: ANNEE });
  assert.ok(!stats.includes("Aminata"), "statistiques seules : aucun nom d'élève");
  assert.ok(!stats.includes("Par section"), "une seule section : pas de tableau par section");
  assert.ok(!stats.includes("DEMANDES DE DISPENSE"));
  assert.ok(stats.includes("Par poste"));
});
