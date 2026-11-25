import assert from "node:assert/strict";
import test from "node:test";

import {
  grouperSituation, lignesSituation, situationEleve, totalSituation, totauxSituation,
} from "../src/components/comptabilite/mensualites-tab/situation-generale.js";
import { situationGeneraleHTML } from "../src/reports/listes-mensualites.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const ANNEE = "2026-2027";
const TARIFS = [{ classe: "6e A", montant: 100000 }, { classe: "1ère Année A", montant: 80000 }];
// 10 décembre : octobre, novembre, décembre échus, et juin (mois de garantie,
// dû dès la rentrée) ; janvier → mai pas encore.
const opts = (extra = {}) => ({
  moisAnnee: MOIS, annee: ANNEE, tarifsClasses: TARIFS, aujourdhui: new Date("2026-12-10T12:00:00"), ...extra,
});
const ecole = { nom: "École Test", monnaie: "GNF" };
const etats = (l) => l.cases.map((c) => c.etat);

const acompte = {
  _id: "a", nom: "ESSAI", prenom: "Aminata", classe: "6e A",
  mens: { Octobre: "Payé", Novembre: "Payé", Juin: "Payé" }, mensAcomptes: { Décembre: 20000 },
};
const retard = { _id: "b", nom: "EXEMPLE", prenom: "Paul", classe: "6e A", mens: { Octobre: "Payé" } };
const aJour = {
  _id: "c", nom: "FICTIF", prenom: "Marie", classe: "6e A",
  mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Payé", Juin: "Payé" }, inscriptionPayee: true, inscriptionMontant: 50000,
};

test("situationEleve : une case par mois — payé, acompte, impayé échu, à venir", () => {
  const a = situationEleve(acompte, opts());
  assert.deepEqual(etats(a),
    ["paye", "paye", "acompte", "avenir", "avenir", "avenir", "avenir", "avenir", "paye"]);
  assert.equal(a.cases[2].acompte, 20000);
  assert.equal(a.moisPayes, 3);
  // L'acompte ne solde pas décembre : l'élève est en retard d'un mois.
  assert.equal(a.enRetard, true);
  assert.equal(a.moisRetard, 1);
  assert.equal(a.total, 320000);

  const b = situationEleve(retard, opts());
  assert.deepEqual(etats(b),
    ["paye", "impaye", "impaye", "avenir", "avenir", "avenir", "avenir", "avenir", "impaye"]);
  assert.equal(b.moisRetard, 3);

  const c = situationEleve(aJour, opts());
  assert.equal(c.enRetard, false);
  // Total payé : 4 mois + inscription.
  assert.equal(c.total, 450000);
});

test("situationEleve : mois non dus après un départ ou sous dispense totale", () => {
  const parti = { _id: "p", classe: "6e A", mens: { Octobre: "Payé" }, statut: "Transféré", dateDepart: "2026-10-20" };
  const p = situationEleve(parti, opts());
  assert.equal(p.cases[0].etat, "paye");
  assert.ok(p.cases.slice(1).every((c) => c.etat === "nondu"));
  assert.equal(p.enRetard, false);

  const dispense = { _id: "d", classe: "6e A", mens: {},
    exoneration: { annee: ANNEE, mensualites: 100, inscription: 0, fraisAnnexes: 0, motif: "orphelin" } };
  const d = situationEleve(dispense, opts());
  assert.ok(d.cases.every((c) => c.etat === "nondu"));
  assert.equal(d.enRetard, false);
});

test("lignesSituation : tous, en retard seulement, à jour seulement", () => {
  const ids = (lignes) => lignes.map((l) => l.eleve._id);
  assert.deepEqual(ids(lignesSituation([acompte, retard, aJour], opts())), ["a", "b", "c"]);
  assert.deepEqual(ids(lignesSituation([acompte, retard, aJour], opts({ filtre: "retard" }))), ["a", "b"]);
  assert.deepEqual(ids(lignesSituation([acompte, retard, aJour], opts({ filtre: "ajour" }))), ["c"]);
});

test("totauxSituation : effectif, à jour / en retard, élèves ayant payé chaque mois, total", () => {
  const t = totauxSituation(lignesSituation([acompte, retard, aJour], opts()));
  assert.equal(t.effectif, 3);
  assert.equal(t.aJour, 1);
  assert.equal(t.enRetard, 2);
  assert.deepEqual(t.parMois, [3, 2, 1, 0, 0, 0, 0, 0, 2]);
  assert.equal(t.total, 320000 + 100000 + 450000);
  assert.deepEqual(totauxSituation([]),
    { effectif: 0, aJour: 0, enRetard: 0, parMois: [], mensualites: 0, autres: 0, total: 0 });
});

const primaire = { _id: "e", nom: "<b>X</b>", prenom: "Y", classe: "1ère Année A", mens: { Octobre: "Payé" } };
const groupes = () => grouperSituation(lignesSituation([acompte, retard, aJour, primaire], opts()));

test("situationGeneraleHTML (élève par élève) : cases, état de chaque classe, payé par mois, tableau des classes", () => {
  const g = groupes();
  assert.deepEqual(g.map((x) => x.classe), ["1ère Année A", "6e A"]);
  assert.equal(totalSituation(g).effectif, 4);
  const html = situationGeneraleHTML(g, { moisAnnee: MOIS, schoolInfo: ecole, annee: ANNEE, perimetre: "Toutes sections" });
  assert.match(html, /SITUATION GÉNÉRALE DES PAIEMENTS/);
  assert.match(html, /Toutes sections/);
  assert.match(html, /6e A — 3 élève\(s\) · 1 à jour · 2 en retard/);
  assert.match(html, /class="mois impaye">✗/);
  assert.match(html, /◐<br\/>20\D?000/);
  assert.match(html, /6e A — payé par mois/);
  assert.match(html, /TOTAL — 4 élève\(s\) — payé par mois/);
  assert.match(html, /Situation par classe/);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>X<\/b>/);
  // Le primaire avant le collège.
  assert.ok(html.indexOf("1ère Année A —") < html.indexOf("6e A —"));
  // Pas de colonne « reste à payer ».
  assert.doesNotMatch(html, /Reste/);
});

test("situationGeneraleHTML (classes seules) : le tableau des classes, sans les élèves", () => {
  const html = situationGeneraleHTML(groupes(), { moisAnnee: MOIS, detail: "classes", schoolInfo: ecole, annee: ANNEE });
  assert.doesNotMatch(html, /ESSAI/);
  assert.match(html, /À jour/);
  assert.match(html, /En retard/);
  assert.match(html, /<td><strong>6e A<\/strong><\/td><td class="c">3<\/td>/);
  // Légende des cases inutile sans cases.
  assert.doesNotMatch(html, /pas encore dû/);
});

test("situationGeneraleHTML : une page par classe et filtre rappelé", () => {
  const html = situationGeneraleHTML(groupes(), {
    moisAnnee: MOIS, filtre: "retard", pageParClasse: true, schoolInfo: ecole, annee: ANNEE,
  });
  // Deux classes : la seconde et le tableau des classes commencent une nouvelle page.
  assert.equal((html.match(/<div class="saut">/g) || []).length, 2);
  assert.match(html, /Élèves en retard seulement/);
});
