import assert from "node:assert/strict";
import test from "node:test";
import { CRITERES_TRI, cleDate, dernierPaiement, trierEleves } from "../src/tri-eleves.js";

const MOIS = ["Octobre", "Novembre", "Décembre"];
const TARIFS = [{ classe: "7ème A", montant: 100000, inscription: 50000 }, { classe: "6ème A", montant: 100000, inscription: 50000 }];
const noms = (liste) => liste.map((e) => e.nom);

// Déjà dans l'ordre alphabétique de l'école, comme les listes de l'app.
const ELEVES = [
  { _id: "1", nom: "Bah", prenom: "Aminata", classe: "7ème A", matricule: "M-3", sexe: "F", dateNaissance: "12/05/2012",
    mens: { Octobre: "Payé", Novembre: "Payé" }, mensDates: { Octobre: "02/10/2026", Novembre: "03/11/2026" }, inscriptionPayee: true, inscriptionDate: "01/10/2026" },
  { _id: "2", nom: "Camara", prenom: "Ibrahima", classe: "6ème A", matricule: "M-1", sexe: "M", dateNaissance: "2011-01-20",
    mens: {}, inscriptionPayee: false },
  { _id: "3", nom: "Diallo", prenom: "Fanta", classe: "6ème A", matricule: "M-2", sexe: "F", dateNaissance: "",
    mens: { Octobre: "Payé" }, mensDates: { Octobre: "15/10/2026" }, inscriptionPayee: true, inscriptionDate: "01/09/2026" },
];
const ctx = { moisAnnee: MOIS, tarifsClasses: TARIFS };

test("cleDate lit jj/mm/aaaa et ISO", () => {
  assert.equal(cleDate("03/11/2026"), 20261103);
  assert.equal(cleDate("2026-11-03T10:00:00Z"), 20261103);
  assert.equal(cleDate(""), 0);
  assert.equal(dernierPaiement(ELEVES[0]), 20261103);
  assert.equal(dernierPaiement(ELEVES[1]), 0);
});

test("alpha laisse l'ordre de l'école ; critères de base", () => {
  assert.equal(trierEleves(ELEVES, "alpha"), ELEVES);
  assert.deepEqual(noms(trierEleves(ELEVES, "nom_desc")), ["Diallo", "Camara", "Bah"]);
  // Même classe : l'ordre alphabétique est conservé (tri stable).
  assert.deepEqual(noms(trierEleves(ELEVES, "classe")), ["Camara", "Diallo", "Bah"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "matricule")), ["Camara", "Diallo", "Bah"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "sexe")), ["Bah", "Diallo", "Camara"]);
  // Sans date de naissance : en fin de liste.
  assert.deepEqual(noms(trierEleves(ELEVES, "age_desc")), ["Camara", "Bah", "Diallo"]);
});

test("critères de paiement", () => {
  assert.deepEqual(noms(trierEleves(ELEVES, "reste_desc", ctx)), ["Camara", "Diallo", "Bah"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "impayes_desc", ctx)), ["Camara", "Diallo", "Bah"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "payes_desc", ctx)), ["Bah", "Diallo", "Camara"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "paiement_recent", ctx)), ["Bah", "Diallo", "Camara"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "paiement_ancien", ctx)), ["Camara", "Diallo", "Bah"]);
  assert.deepEqual(noms(trierEleves(ELEVES, "inscription_non_payee")), ["Camara", "Bah", "Diallo"]);
  // Sans les mois de l'année, un critère de paiement ne trie pas.
  assert.equal(trierEleves(ELEVES, "reste_desc"), ELEVES);
});

test("chaque liste propose l'alphabétique et des identifiants uniques", () => {
  for (const [liste, criteres] of Object.entries(CRITERES_TRI)) {
    assert.equal(criteres[0].id, "alpha", liste);
    assert.equal(new Set(criteres.map((c) => c.id)).size, criteres.length, liste);
  }
});
