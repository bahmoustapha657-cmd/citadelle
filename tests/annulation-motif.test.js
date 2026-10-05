import assert from "node:assert/strict";
import test from "node:test";
import { collecterMouvements, totauxMouvements } from "../src/components/comptabilite/caisse/caisse-utils.js";
import {
  ecritureAnnulation, ecritureEncaissement, lignesNeutralisees, mouvementsDepuisJournal,
} from "../src/components/comptabilite/paiements-journal.js";

const annee = "2026-2027";
const eleve = { _id: "e1", nom: "DIALLO", prenom: "Awa", classe: "7ème A" };
let horloge = 0;
const enc = (mois, montant, date = "2026-10-05") => ({
  ...ecritureEncaissement({ annee, eleve, type: "mensualite", mois, libelle: mois, montant, date }),
  _id: `enc-${++horloge}`, createdAt: horloge,
});
const ann = (mois, montant, extra = {}, date = "2026-10-05") => ({
  ...ecritureAnnulation({ annee, eleve, type: "mensualite", mois, libelle: mois, montant, date, ...extra }),
  _id: `ann-${++horloge}`, createdAt: horloge,
});
const totaux = (paiements) => totauxMouvements(collecterMouvements({ eleves: [], moisAnnee: [], tarifsClasses: [], paiements, annee }));

test("l'annulation garde motif et explication", () => {
  const l = ecritureAnnulation({ annee, eleve, type: "mensualite", mois: "Octobre", montant: 100000, motif: "erreur_saisie", explication: "  mauvaise ligne " });
  assert.equal(l.statut, "annule");
  assert.equal(l.motif, "erreur_saisie");
  assert.equal(l.explication, "mauvaise ligne");
  assert.equal("motif" in ecritureAnnulation({ annee, eleve, type: "mensualite", mois: "Octobre", montant: 1 }), false);
});

test("erreur de saisie : ni entrée ni sortie, la trace reste", () => {
  const lignes = [enc("Octobre", 100000), ann("Octobre", 100000, { motif: "erreur_saisie", explication: "mauvais élève" })];
  assert.equal(lignesNeutralisees(lignes).size, 2);
  const t = totaux(lignes);
  assert.equal(t.entrees, 0);
  assert.equal(t.sorties, 0);
  assert.equal(t.nb, 2); // les deux lignes restent listées
  const mvts = mouvementsDepuisJournal(lignes);
  assert.deepEqual(mvts.map((m) => m.sens), ["neutre", "neutre"]);
  assert.match(mvts[1].detail, /mauvais élève/);
});

test("remboursement et ancienne annulation sans motif : sortie de caisse", () => {
  for (const extra of [{ motif: "remboursement", explication: "rendu au parent" }, {}]) {
    const t = totaux([enc("Octobre", 100000), ann("Octobre", 100000, extra)]);
    assert.equal(t.entrees, 100000);
    assert.equal(t.sorties, 100000);
  }
});

test("acompte puis solde, décoché par erreur : les deux encaissements sont neutralisés", () => {
  const lignes = [
    enc("Novembre", 30000), enc("Novembre", 70000),
    ann("Novembre", 100000, { motif: "erreur_saisie", explication: "x" }),
    enc("Décembre", 100000),
  ];
  const t = totaux(lignes);
  assert.equal(t.entrees, 100000); // seul Décembre compte
  assert.equal(t.sorties, 0);
});

test("re-coché après correction : le nouvel encaissement compte", () => {
  const lignes = [
    enc("Octobre", 100000), ann("Octobre", 100000, { motif: "erreur_saisie", explication: "x" }), enc("Octobre", 100000),
  ];
  assert.equal(totaux(lignes).entrees, 100000);
});

test("correction sans encaissement au journal : retirée des entrées, jamais une sortie", () => {
  const t = totaux([ann("Octobre", 100000, { motif: "erreur_saisie", explication: "payé avant le journal" })]);
  assert.equal(t.entrees, -100000);
  assert.equal(t.sorties, 0);
});
