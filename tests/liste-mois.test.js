import assert from "node:assert/strict";
import test from "node:test";

import {
  grouperParClasse, lignesListeMois, moisParDefaut, totauxListeMois,
} from "../src/components/comptabilite/mensualites-tab/liste-mois.js";
import { listeMoisHTML } from "../src/reports/listes-mensualites.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const ANNEE = "2026-2027";
const TARIFS = [{ classe: "6e A", montant: 100000 }, { classe: "1ère Année A", montant: 80000 }];
const opts = (extra = {}) => ({ moisAnnee: MOIS, annee: ANNEE, tarifsClasses: TARIFS, mois: "Novembre", ...extra });
const ecole = { nom: "École Test", monnaie: "GNF" };

test("moisParDefaut : le mois en cours s'il est dans l'année, sinon le premier", () => {
  assert.equal(moisParDefaut(MOIS, new Date("2026-11-25T12:00:00")), "Novembre");
  assert.equal(moisParDefaut(MOIS, new Date("2027-01-03T12:00:00")), "Janvier");
  // Septembre, juillet : hors de l'année scolaire.
  assert.equal(moisParDefaut(MOIS, new Date("2026-09-10T12:00:00")), "Octobre");
  assert.equal(moisParDefaut(MOIS, new Date("2027-07-10T12:00:00")), "Octobre");
  assert.equal(moisParDefaut([]), "");
});

test("ont payé le mois : montant figé du mois et total payé dans l'année", () => {
  const a = {
    _id: "a", nom: "ESSAI", prenom: "Aminata", classe: "6e A",
    mens: { Octobre: "Payé", Novembre: "Payé", Juin: "Payé" }, mensMontants: { Novembre: 90000 },
    mensAcomptes: { Décembre: 20000 }, inscriptionPayee: true, inscriptionMontant: 50000,
  };
  const b = { _id: "b", nom: "EXEMPLE", prenom: "Paul", classe: "6e A", mens: { Octobre: "Payé" }, mensAcomptes: { Novembre: 30000 } };
  const lignes = lignesListeMois([a, b], opts());
  // b n'a versé qu'un acompte sur novembre : il n'a pas payé le mois.
  assert.deepEqual(lignes.map((l) => l.eleve._id), ["a"]);
  const [l] = lignes;
  assert.deepEqual(l.moisPayes, ["Octobre", "Novembre", "Juin"]);
  assert.equal(l.montantMois, 90000);
  // Mensualités : 100 000 + 90 000 + 100 000 + acompte de décembre 20 000.
  assert.equal(l.mensualites, 310000);
  assert.equal(l.autres, 50000);
  assert.equal(l.total, 360000);
  assert.deepEqual(lignesListeMois([a, b], opts({ mois: "" })), []);
});

test("pas encore payé le mois : reste dû, acompte déduit ; ni départ ni dispense totale", () => {
  const acompte = { _id: "acompte", classe: "6e A", mens: { Octobre: "Payé" }, mensAcomptes: { Novembre: 30000 } };
  const rien = { _id: "rien", classe: "6e A", mens: {} };
  const paye = { _id: "paye", classe: "6e A", mens: { Novembre: "Payé" } };
  const parti = { _id: "parti", classe: "6e A", mens: { Octobre: "Payé" }, statut: "Transféré", dateDepart: "2026-10-20" };
  const dispense = { _id: "dispense", classe: "6e A", mens: {},
    exoneration: { annee: ANNEE, mensualites: 100, inscription: 0, fraisAnnexes: 0, motif: "orphelin" } };
  const moitie = { _id: "moitie", classe: "6e A", mens: {},
    exoneration: { annee: ANNEE, mensualites: 50, inscription: 0, fraisAnnexes: 0, motif: "personnel" } };
  const lignes = lignesListeMois([acompte, rien, paye, parti, dispense, moitie], opts({ statut: "impayes" }));
  assert.deepEqual(lignes.map((l) => l.eleve._id), ["acompte", "rien", "moitie"]);
  assert.deepEqual(lignes.map((l) => l.montantMois), [70000, 100000, 50000]);
  assert.equal(lignes[0].acompte, 30000);
  // Total payé : mois d'octobre + acompte de novembre.
  assert.equal(lignes[0].total, 130000);
});

test("grouperParClasse : classes dans l'ordre des niveaux, sans classe à la fin, sous-totaux", () => {
  const l = (id, classe, montantMois, total) => ({ eleve: { _id: id, classe }, montantMois, mensualites: total, autres: 0, total });
  const groupes = grouperParClasse([
    l("1", "6e A", 100000, 300000), l("2", "", 5000, 5000), l("3", "1ère Année A", 80000, 80000), l("4", "6e A", 90000, 90000),
  ]);
  assert.deepEqual(groupes.map((g) => g.classe), ["1ère Année A", "6e A", ""]);
  assert.deepEqual(groupes[1].lignes.map((x) => x.eleve._id), ["1", "4"]);
  assert.equal(groupes[1].montantMois, 190000);
  assert.equal(groupes[1].total, 390000);
  assert.deepEqual(totauxListeMois([]), { montantMois: 0, mensualites: 0, autres: 0, total: 0 });
});

test("listeMoisHTML (ont payé) : titre du mois, une ligne par élève, sous-totaux, récapitulatif", () => {
  const eleves = [
    { _id: "a", nom: "ESSAI", prenom: "Aminata", matricule: "M1", classe: "6e A", mens: { Octobre: "Payé", Novembre: "Payé" } },
    { _id: "b", nom: "<b>X</b>", prenom: "Y", classe: "1ère Année A", mens: { Novembre: "Payé" } },
  ];
  const groupes = grouperParClasse(lignesListeMois(eleves, opts()));
  const html = listeMoisHTML(groupes, { mois: "Novembre", schoolInfo: ecole, annee: ANNEE, perimetre: "Toutes sections" });
  assert.match(html, /ÉLÈVES AYANT PAYÉ — NOVEMBRE/);
  assert.match(html, /Toutes sections/);
  assert.match(html, /Oct · Nov/);
  assert.match(html, /Sous-total 6e A/);
  assert.match(html, /TOTAL — 2 élève\(s\)/);
  assert.match(html, /Récapitulatif par classe/);
  // 100 000 (6e A) + 80 000 (1ère Année A) encaissés pour novembre.
  assert.match(html, /180\D?000/);
  assert.match(html, /&lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>X<\/b>/);
  // Le primaire (1ère Année) avant le collège (6e).
  assert.ok(html.indexOf("1ère Année A —") < html.indexOf("6e A —"));
});

test("listeMoisHTML (pas encore payé) : reste dû, tuteur, téléphone ; une page par classe", () => {
  const eleves = [
    { _id: "a", nom: "FICTIF", prenom: "Marie", classe: "6e A", mens: {}, mensAcomptes: { Novembre: 30000 }, tuteur: "M. Fictif", contactTuteur: "622 00 00 00" },
    { _id: "b", nom: "EXEMPLE", prenom: "Paul", classe: "1ère Année A", mens: {} },
  ];
  const groupes = grouperParClasse(lignesListeMois(eleves, opts({ statut: "impayes" })));
  const html = listeMoisHTML(groupes, { mois: "Novembre", statut: "impayes", pageParClasse: true, schoolInfo: ecole, annee: ANNEE });
  assert.match(html, /N'AYANT PAS ENCORE PAYÉ — NOVEMBRE/);
  assert.match(html, /Reste dû Novembre \(GNF\)/);
  assert.match(html, /acompte 30\D?000/);
  assert.match(html, /M\. Fictif/);
  assert.match(html, /622 00 00 00/);
  // Deux classes : la seconde et le récapitulatif commencent une nouvelle page.
  assert.equal((html.match(/<div class="saut">/g) || []).length, 2);
});
