import assert from "node:assert/strict";
import test from "node:test";

import {
  grouperSituation, lignesSituation, situationEleve, totalSituation, totauxSituation,
} from "../src/components/comptabilite/mensualites-tab/situation-generale.js";
import { situationGeneraleHTML } from "../src/reports/listes-mensualites.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const ANNEE = "2026-2027";
// Inscription due en 6e A seulement : au primaire, elle n'est pas due (tarif nul).
const TARIFS = [{ classe: "6e A", montant: 100000, inscription: 50000 }, { classe: "1ère Année A", montant: 80000 }];
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

test("situationEleve : montant encaissé sur chaque mois, état et montant de l'inscription", () => {
  const a = situationEleve(acompte, opts());
  assert.deepEqual(a.cases.map((c) => c.montant), [100000, 100000, 20000, 0, 0, 0, 0, 0, 100000]);
  assert.equal(a.mensualites, 320000);
  // Inscription due (50 000 en 6e A), rien versé.
  assert.equal(a.etatInscription, "nonpayee");
  assert.equal(a.inscription, 0);

  const c = situationEleve(aJour, opts());
  assert.equal(c.etatInscription, "payee");
  assert.equal(c.inscription, 50000);
  assert.equal(c.autres, 50000);

  const partie = situationEleve({ _id: "i", classe: "6e A", mens: {}, inscriptionAcompte: 20000 }, opts());
  assert.equal(partie.etatInscription, "acompte");
  assert.equal(partie.inscription, 20000);
  assert.equal(partie.total, 20000);

  const dispense = situationEleve({ _id: "j", classe: "6e A", mens: {},
    exoneration: { annee: ANNEE, mensualites: 0, inscription: 100, fraisAnnexes: 0, motif: "orphelin" } }, opts());
  assert.equal(dispense.etatInscription, "nondue");
  // Au primaire, pas de tarif d'inscription : rien n'est dû.
  assert.equal(situationEleve({ _id: "k", classe: "1ère Année A", mens: {} }, opts()).etatInscription, "nondue");
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
  assert.deepEqual(totauxSituation([]), {
    effectif: 0, aJour: 0, enRetard: 0, parMois: [], statsMois: [], moisPayes: 0, acomptes: 0,
    inscription: { payee: 0, acompte: 0, nonpayee: 0, nondue: 0, montant: 0 },
    mensualites: 0, annexes: 0, autres: 0, total: 0,
  });
});

test("totauxSituation : statistiques mois par mois, mois payés, inscription, montants", () => {
  const t = totauxSituation(lignesSituation([acompte, retard, aJour], opts()));
  const mois = (paye, acompte_, impaye, avenir, montant) => ({ paye, acompte: acompte_, impaye, avenir, nondu: 0, montant });
  assert.deepEqual(t.statsMois[0], mois(3, 0, 0, 0, 300000)); // octobre
  assert.deepEqual(t.statsMois[1], mois(2, 0, 1, 0, 200000)); // novembre
  assert.deepEqual(t.statsMois[2], mois(1, 1, 1, 0, 120000)); // décembre : un acompte
  assert.deepEqual(t.statsMois[3], mois(0, 0, 0, 3, 0)); // janvier : pas encore dû
  assert.deepEqual(t.statsMois[8], mois(2, 0, 1, 0, 200000)); // juin, mois de garantie
  assert.equal(t.moisPayes, 8);
  assert.equal(t.acomptes, 1);
  assert.deepEqual(t.inscription, { payee: 1, acompte: 0, nonpayee: 2, nondue: 0, montant: 50000 });
  assert.equal(t.mensualites, 820000);
  // Le total encaissé est la somme des mois, de l'inscription et des frais annexes.
  assert.equal(t.statsMois.reduce((s, m) => s + m.montant, 0), t.mensualites);
  assert.equal(t.total, t.mensualites + t.inscription.montant + t.annexes);

  // Un élève parti : ses mois après le départ sont comptés « non dus ».
  const parti = { _id: "p", classe: "6e A", mens: { Octobre: "Payé" }, statut: "Transféré", dateDepart: "2026-10-20" };
  const tp = totauxSituation(lignesSituation([parti], opts()));
  assert.equal(tp.statsMois[1].nondu, 1);
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
  assert.match(html, /Situation par classe/);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>X<\/b>/);
  // Le primaire avant le collège.
  assert.ok(html.indexOf("1ère Année A —") < html.indexOf("6e A —"));
  // Pas de colonne « reste à payer ».
  assert.doesNotMatch(html, /Reste/);
});

test("situationGeneraleHTML : statistiques sous chaque classe, statistiques générales à la fin", () => {
  const html = situationGeneraleHTML(groupes(), { moisAnnee: MOIS, schoolInfo: ecole, annee: ANNEE });
  // Une par classe, plus celle de toutes les classes.
  assert.equal((html.match(/<table class="stats">/g) || []).length, 3);
  assert.match(html, /📊 STATISTIQUES — 1ère Année A/);
  assert.match(html, /📊 STATISTIQUES — 6e A/);
  assert.match(html, /📊 STATISTIQUES GÉNÉRALES — 2 classe\(s\)/);
  // Chaque classe : ses élèves, puis ses statistiques, avant la classe suivante.
  const debut6e = html.indexOf("6e A — 3 élève");
  assert.ok(html.indexOf("STATISTIQUES — 1ère Année A") < debut6e);
  assert.ok(debut6e < html.indexOf("STATISTIQUES — 6e A"));
  // Les statistiques générales après le tableau des classes, à la toute fin.
  assert.ok(html.indexOf("Situation par classe") < html.indexOf("STATISTIQUES GÉNÉRALES"));
  // 6e A, novembre : 2 payé, 0 acompte, 1 impayé, 0 pas dû, 67 %.
  assert.match(html, /Novembre<\/td>\s*<td class="c">2<\/td><td class="c">0<\/td><td class="c">1<\/td><td class="c">0<\/td>\s*<td class="c">67 %<\/td>/);
  // Janvier : personne ne le doit encore, pas de pourcentage.
  assert.match(html, /Janvier<\/td>\s*<td class="c">0<\/td><td class="c">0<\/td><td class="c">0<\/td><td class="c">3<\/td>\s*<td class="c">—<\/td>/);
  assert.match(html, /Mensualités \(nombre de mois\)<\/td><td class="c">8<\/td><td class="c">1<\/td>/);
  // Inscription en 6e A : 1 payée, 0 acompte, 2 non payées, 0 non due, 33 %.
  assert.match(html, /réinscription \(élèves\)<\/td><td class="c">1<\/td><td class="c">0<\/td>\s*<td class="c">2<\/td><td class="c">0<\/td><td class="c">33 %<\/td>/);
  assert.match(html, /Frais annexes/);
  assert.match(html, /TOTAL ENCAISSÉ/);
  // Tableau des classes : inscriptions payées par classe.
  assert.match(html, /Inscr\. payées/);
});

test("situationGeneraleHTML : une seule classe, pas de statistiques générales en double", () => {
  const g = grouperSituation(lignesSituation([acompte, retard], opts()));
  const html = situationGeneraleHTML(g, { moisAnnee: MOIS, schoolInfo: ecole, annee: ANNEE });
  assert.equal((html.match(/<table class="stats">/g) || []).length, 1);
  assert.doesNotMatch(html, /STATISTIQUES GÉNÉRALES/);
});

test("situationGeneraleHTML (classes seules) : le tableau des classes, sans les élèves", () => {
  const html = situationGeneraleHTML(groupes(), { moisAnnee: MOIS, detail: "classes", schoolInfo: ecole, annee: ANNEE });
  assert.doesNotMatch(html, /ESSAI/);
  assert.match(html, /À jour/);
  assert.match(html, /En retard/);
  assert.match(html, /<td><strong>6e A<\/strong><\/td><td class="c">3<\/td>/);
  // Légende des cases inutile sans cases.
  assert.doesNotMatch(html, /« — » pas encore dû/);
  // Les statistiques de toutes les classes suivent le tableau des classes ;
  // pas de statistiques par classe sans les élèves.
  assert.equal((html.match(/<table class="stats">/g) || []).length, 1);
  assert.match(html, /STATISTIQUES GÉNÉRALES — 2 classe\(s\)/);
});

test("situationGeneraleHTML : une page par classe et filtre rappelé", () => {
  const html = situationGeneraleHTML(groupes(), {
    moisAnnee: MOIS, filtre: "retard", pageParClasse: true, schoolInfo: ecole, annee: ANNEE,
  });
  // Deux classes : la seconde et la fin (tableau des classes, statistiques
  // générales) commencent une nouvelle page.
  assert.equal((html.match(/<div class="[^"]*\bsaut\b/g) || []).length, 2);
  assert.match(html, /Élèves en retard seulement/);
});
