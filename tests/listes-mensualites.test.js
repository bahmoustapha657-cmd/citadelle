import assert from "node:assert/strict";
import test from "node:test";

import { listeNonReinscritsHTML, listePayesHTML } from "../src/reports/listes-mensualites.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const ecole = { nom: "École Test", monnaie: "GNF" };
const compter = (html, motif) => (html.match(motif) || []).length;

test("liste des élèves ayant payé : grille des mois, acomptes, totaux par mois", () => {
  const lignes = [
    { eleve: { nom: "DIALLO", prenom: "Awa", classe: "6e A", matricule: "M1" }, mois: ["Octobre", "Juin"], acomptes: [{ mois: "Novembre", montant: 30000 }], montant: 230000 },
    { eleve: { nom: "<b>X</b>", prenom: "Y", classe: "6e A" }, mois: ["Octobre"], acomptes: [], montant: 100000 },
  ];
  const html = listePayesHTML(lignes, { schoolInfo: ecole, annee: "2026-2027", perimetre: "Classe 6e A", moisAnnee: MOIS });
  assert.match(html, /ÉLÈVES AYANT PAYÉ/);
  // Mois abrégés en en-tête : dix colonnes tiennent sur un A4.
  assert.match(html, /<th class="c">Oct<\/th>/);
  assert.match(html, /<th class="c">Jun<\/th>/);
  assert.equal(compter(html, /<td class="mois paye">✓<\/td>/g), 3);
  assert.match(html, /<td class="mois acompte">◐<br\/>30\D?000<\/td>/);
  // Ligne de pied : 2 élèves ont payé Octobre, 1 Juin, 0 Novembre.
  assert.match(html, /payé par mois<\/td><td class="c">2<\/td><td class="c">0<\/td>/);
  assert.match(html, /330\D?000/);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>X<\/b>/);
});

test("liste des non réinscrits : type, acompte, mois déjà payés, reste dû, contacts", () => {
  const lignes = [
    { eleve: { nom: "SOW", prenom: "Ali", classe: "5e B", tuteur: "M. Sow", contactTuteur: "622 00 00 00" }, type: "Réinscription", reste: 20000, acompte: 10000, moisPayes: 2 },
    { eleve: { nom: "BAH", prenom: "Ina", classe: "5e B" }, type: "Inscription", reste: 50000, acompte: 0, moisPayes: 0 },
  ];
  const html = listeNonReinscritsHTML(lignes, { schoolInfo: ecole, annee: "2026-2027", perimetre: "Collège" });
  assert.match(html, /ÉLÈVES PRÉSENTS NON RÉINSCRITS/);
  assert.match(html, /Réinscription<br\/><span class="mat">acompte 10\D?000<\/span>/);
  assert.match(html, /M\. Sow/);
  assert.match(html, /622 00 00 00/);
  assert.match(html, /TOTAL — 2 élève\(s\)/);
  assert.match(html, /70\D?000/);
});

test("liste des élèves ayant payé : le classement choisi est imprimé", () => {
  const lignes = [{ eleve: { nom: "DIALLO", prenom: "Awa", classe: "6e A" }, mois: ["Octobre"], acomptes: [], montant: 100000 }];
  const html = listePayesHTML(lignes, { schoolInfo: ecole, moisAnnee: MOIS, tri: "Nombre de mois payés, décroissant" });
  assert.match(html, /Classement : Nombre de mois payés, décroissant/);
  assert.doesNotMatch(listePayesHTML(lignes, { schoolInfo: ecole, moisAnnee: MOIS }), /Classement/);
});
