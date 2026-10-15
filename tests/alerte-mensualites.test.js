import assert from "node:assert/strict";
import test from "node:test";

import {
  ALERTE_DEFAUT, elevesEnRetard, moisEchus, reglagesAlerte, retardEleve,
} from "../src/components/comptabilite/mensualites-tab/alerte-mensualites.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const ANNEE = "2026-2027";
const TARIFS = [{ classe: "6e A", montant: 100000 }];
const le = (iso) => new Date(`${iso}T12:00:00`);
const opts = (aujourdhui, extra = {}) => ({ moisAnnee: MOIS, annee: ANNEE, tarifsClasses: TARIFS, aujourdhui, ...extra });

test("reglagesAlerte : défauts, puis valeurs bornées comme le serveur", () => {
  assert.deepEqual(reglagesAlerte({}), ALERTE_DEFAUT);
  assert.deepEqual(reglagesAlerte({ alerteMensualites: { jourEcheance: 10, seuilMois: 3 } }), { jourEcheance: 10, seuilMois: 3 });
  assert.deepEqual(reglagesAlerte({ alerteMensualites: { jourEcheance: 31, seuilMois: 0 } }), ALERTE_DEFAUT);
  assert.deepEqual(reglagesAlerte({ alerteMensualites: { jourEcheance: 2.5, seuilMois: "x" } }), ALERTE_DEFAUT);
});

test("moisEchus : seuls les mois dont l'échéance est passée (sans garantie)", () => {
  assert.deepEqual(moisEchus(MOIS, ANNEE, 1, le("2026-10-14"), 0), ["Octobre"]);
  assert.deepEqual(moisEchus(MOIS, ANNEE, 15, le("2026-10-14"), 0), []);
  assert.deepEqual(moisEchus(MOIS, ANNEE, 10, le("2027-01-10"), 0), ["Octobre", "Novembre", "Décembre", "Janvier"]);
  // Mois courts acceptés ; année illisible : rien d'échu (pas de fausse alerte).
  assert.deepEqual(moisEchus(["Oct", "Nov"], ANNEE, 1, le("2026-11-02"), 0), ["Oct", "Nov"]);
  assert.deepEqual(moisEchus(MOIS, "", 1, le("2027-06-30")), []);
});

test("moisEchus : les mois de garantie sont dus dès l'échéance du 1er mois", () => {
  // Par défaut : le dernier mois.
  assert.deepEqual(moisEchus(MOIS, ANNEE, 1, le("2026-10-14")), ["Octobre", "Juin"]);
  assert.deepEqual(moisEchus(MOIS, ANNEE, 1, le("2026-10-14"), 2), ["Octobre", "Mai", "Juin"]);
  // Avant l'échéance du premier mois, rien n'est dû, garantie comprise.
  assert.deepEqual(moisEchus(MOIS, ANNEE, 15, le("2026-10-14"), 2), []);
});

test("retardEleve : les mois à venir ne comptent pas, sauf la garantie", () => {
  const e = { classe: "6e A", mens: {} };
  assert.deepEqual(retardEleve(e, opts(le("2026-10-14"))), { mois: ["Octobre", "Juin"], montant: 200000 });
  assert.deepEqual(retardEleve(e, opts(le("2026-10-14"), { moisGarantie: 0 })), { mois: ["Octobre"], montant: 100000 });
  // Garantie de 2 mois : Juin payé, Mai manque encore.
  const juinPaye = { classe: "6e A", mens: { Juin: "Payé", Octobre: "Payé" } };
  assert.deepEqual(retardEleve(juinPaye, opts(le("2026-10-14"), { moisGarantie: 2 })).mois, ["Mai"]);
});

test("retardEleve : un premier versement (dernier mois coché) ne masque plus le retard", () => {
  // Ordre d'encaissement : inscription, puis Juin, puis Octobre → Mai.
  const e = { classe: "6e A", mens: { Juin: "Payé" } };
  const r = retardEleve(e, opts(le("2026-12-20")));
  assert.deepEqual(r.mois, ["Octobre", "Novembre", "Décembre"]);
  assert.equal(r.montant, 300000);
});

test("retardEleve : acompte déduit, dispense totale = aucun retard", () => {
  const avecAcompte = { classe: "6e A", mens: {}, mensAcomptes: { Octobre: 40000 } };
  assert.deepEqual(retardEleve(avecAcompte, opts(le("2026-10-14"), { moisGarantie: 0 })), { mois: ["Octobre"], montant: 60000 });
  const dispense = { classe: "6e A", mens: {}, exoneration: { annee: ANNEE, mensualites: 100, inscription: 0, fraisAnnexes: 0, motif: "orphelin" } };
  assert.deepEqual(retardEleve(dispense, opts(le("2027-03-01"))), { mois: [], montant: 0 });
});

test("retardEleve : parti en novembre, rien d'exigible après son départ", () => {
  const e = { classe: "6e A", mens: { Octobre: "Payé" }, statut: "Transféré", dateDepart: "2026-11-15" };
  const r = retardEleve(e, opts(le("2027-03-01")));
  assert.deepEqual(r.mois, ["Novembre"]);
});

test("elevesEnRetard : seuil appliqué, plus gros retards d'abord", () => {
  const a = { _id: "a", classe: "6e A", mens: { Octobre: "Payé" } };
  const b = { _id: "b", classe: "6e A", mens: {} };
  const c = { _id: "c", classe: "6e A", mens: { Octobre: "Payé", Novembre: "Payé", Décembre: "Payé" } };
  const liste = elevesEnRetard([a, b, c], { ...opts(le("2026-12-05"), { moisGarantie: 0 }), reglages: { jourEcheance: 1, seuilMois: 2 } });
  assert.deepEqual(liste.map((r) => r.eleve._id), ["b", "a"]);
  assert.equal(liste[0].mois.length, 3);
  // Échéance au 10 : Décembre pas encore en retard le 5 décembre.
  const auDix = elevesEnRetard([a, b, c], { ...opts(le("2026-12-05"), { moisGarantie: 0 }), reglages: { jourEcheance: 10, seuilMois: 2 } });
  assert.deepEqual(auDix.map((r) => r.eleve._id), ["b"]);
  // Garantie par défaut : Juin s'ajoute à chacun ; c (Oct-Déc payés) n'en doit qu'un.
  const garantie = elevesEnRetard([a, b, c], { ...opts(le("2026-12-05")), reglages: { jourEcheance: 1, seuilMois: 2 } });
  assert.deepEqual(garantie.map((r) => [r.eleve._id, r.mois.length]), [["b", 4], ["a", 3]]);
});
