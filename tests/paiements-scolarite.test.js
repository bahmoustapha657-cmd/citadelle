import assert from "node:assert/strict";
import test from "node:test";
import {
  champsRetraitAcompte,
  etatsMois,
  periodeTranche,
  planVersement,
  proposerTranches,
  repartirSurMois,
  trancheDuMois,
  tranchesValides,
} from "../src/paiements-scolarite.js";
import { getEleveMensualiteSnapshot, getEleveSolde } from "../src/mensualite-utils.js";
import { getRecuTotals } from "../src/reports.js";
import { aDesPaiements, etatVierge } from "../src/components/admin/cloture-annee-utils.js";

const MOIS = ["Octobre", "Novembre", "Décembre", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin"];
const TARIFS = [{ classe: "10ème Année A", montant: 110000, inscription: 45000, fraisDivers: { cantine: 300000 } }];
const eleve = (extra = {}) => ({ _id: "e1", classe: "10ème Année A", mens: {}, ...extra });
const appliquer = (e, plan) => ({ ...e, ...plan.champs });

// ── Montant libre réparti sur les mois ────────────────────────────────────
test("250 000 pour une mensualité de 110 000 : 2 mois soldés, acompte de 30 000 sur le 3e", () => {
  const plan = planVersement({ eleve: eleve(), cible: { type: "mois", mois: MOIS }, montant: 250000, date: "05/10/2026", mensualite: 110000 });
  assert.equal(plan.ok, true);
  assert.equal(plan.total, 250000);
  assert.deepEqual(plan.moisSoldes, ["Octobre", "Novembre"]);
  assert.deepEqual(plan.lignes.map((l) => [l.libelle, l.montant]), [
    ["Octobre", 110000], ["Novembre", 110000], ["Décembre (acompte)", 30000],
  ]);
  assert.deepEqual(plan.champs.mens, { Octobre: "Payé", Novembre: "Payé" });
  assert.deepEqual(plan.champs.mensMontants, { Octobre: 110000, Novembre: 110000 });
  assert.deepEqual(plan.champs.mensAcomptes, { Décembre: 30000 });

  // Le mois entamé compte dans le perçu et sort du reste dû.
  const apres = appliquer(eleve(), plan);
  const snap = getEleveMensualiteSnapshot(apres, MOIS, TARIFS);
  assert.equal(snap.montantMensualitesPercu, 250000);
  assert.equal(snap.soldeMensualites, 9 * 110000 - 250000);
  assert.equal(snap.nbPayes, 2);
  assert.equal(snap.nbImpayes, 7); // Décembre reste dû tant qu'il n'est pas soldé
  assert.equal(snap.nbPartiels, 1);
});

test("le versement suivant solde d'abord le mois entamé", () => {
  const avant = appliquer(eleve(), planVersement({ eleve: eleve(), cible: { type: "mois", mois: MOIS }, montant: 250000, mensualite: 110000 }));
  const plan = planVersement({ eleve: avant, cible: { type: "mois", mois: MOIS }, montant: 100000, date: "05/11/2026", mensualite: 110000 });
  assert.deepEqual(plan.lignes.map((l) => [l.libelle, l.montant]), [["Décembre (solde)", 80000], ["Janvier (acompte)", 20000]]);
  // Décembre fige le TOTAL versé (acompte compris) et perd son acompte.
  assert.equal(plan.champs.mensMontants.Décembre, 110000);
  assert.deepEqual(plan.champs.mensAcomptes, { Janvier: 20000 });
  assert.equal(plan.champs.mensDates.Décembre, "05/11/2026");
});

test("un montant au-delà du reste dû est refusé, un montant nul aussi", () => {
  const e = eleve({ mens: Object.fromEntries(MOIS.slice(0, 8).map((m) => [m, "Payé"])) });
  const cible = { type: "mois", mois: MOIS };
  assert.deepEqual(planVersement({ eleve: e, cible, montant: 120000, mensualite: 110000 }), { ok: false, raison: "depasse", reste: 110000 });
  assert.equal(planVersement({ eleve: e, cible, montant: 0, mensualite: 110000 }).raison, "montant");
});

test("une tranche ne paie que ses mois", () => {
  const t2 = { type: "mois", mois: ["Janvier", "Février", "Mars"] };
  const plan = planVersement({ eleve: eleve(), cible: t2, montant: 330000, mensualite: 110000 });
  assert.deepEqual(plan.moisSoldes, ["Janvier", "Février", "Mars"]);
  assert.equal(planVersement({ eleve: eleve(), cible: t2, montant: 340000, mensualite: 110000 }).raison, "depasse");
});

// ── Dispenses : on encaisse ce qui est réellement dû ──────────────────────
test("dispense de moitié : un mois vaut 55 000 ; dispense totale : rien à répartir", () => {
  const moitie = eleve({ exoneration: { mensualites: 50, motif: "personnel" } });
  const plan = planVersement({ eleve: moitie, cible: { type: "mois", mois: MOIS }, montant: 110000, mensualite: 110000 });
  assert.deepEqual(plan.moisSoldes, ["Octobre", "Novembre"]);
  assert.deepEqual(plan.champs.mensMontants, { Octobre: 55000, Novembre: 55000 });

  const totale = eleve({ exoneration: { mensualites: 100, motif: "orphelin" } });
  assert.ok(etatsMois(totale, MOIS, 110000).every((e) => e.statut === "exonere" && e.reste === 0));
  assert.equal(planVersement({ eleve: totale, cible: { type: "mois", mois: MOIS }, montant: 1000, mensualite: 110000 }).raison, "depasse");
});

// ── Frais et inscription en plusieurs fois ────────────────────────────────
test("cantine en deux fois : acompte, puis solde qui fige le total", () => {
  const cible = { type: "poste", poste: "cantine", label: "Cantine", duNet: 300000 };
  const p1 = planVersement({ eleve: eleve(), cible, montant: 100000, date: "05/10/2026" });
  assert.deepEqual(p1.champs, { fraisAcomptes: { cantine: 100000 } });
  assert.deepEqual(p1.lignes.map((l) => [l.type, l.mois, l.libelle, l.montant]), [["frais", "cantine", "Cantine (acompte)", 100000]]);

  const apres = appliquer(eleve(), p1);
  assert.equal(getEleveMensualiteSnapshot(apres, [], TARIFS).montantAutrePercu, 100000);
  assert.equal(getEleveMensualiteSnapshot(apres, [], TARIFS).soldeAutre, 200000);

  const p2 = planVersement({ eleve: apres, cible, montant: 200000, date: "05/01/2027" });
  assert.deepEqual(p2.champs, {
    fraisPayes: { cantine: "05/01/2027" }, fraisMontants: { cantine: 300000 }, fraisAcomptes: {},
  });
  assert.equal(p2.lignes[0].libelle, "Cantine (solde)");
  assert.equal(planVersement({ eleve: apres, cible, montant: 250000 }).raison, "depasse");
});

test("inscription en deux fois : l'élève n'est réinscrit qu'au solde", () => {
  const cible = { type: "poste", poste: "inscription", label: "Inscription", duNet: 45000 };
  const p1 = planVersement({ eleve: eleve(), cible, montant: 20000 });
  assert.deepEqual(p1.champs, { inscriptionAcompte: 20000 });
  const apres = appliquer(eleve(), p1);
  assert.equal(apres.inscriptionPayee, undefined);
  assert.equal(getEleveSolde(apres, [], TARIFS), 25000 + 300000); // reste inscription + cantine

  const p2 = planVersement({ eleve: apres, cible, montant: 25000, date: "06/10/2026" });
  assert.deepEqual(p2.champs, {
    inscriptionPayee: true, inscriptionDate: "06/10/2026", inscriptionMontant: 45000, inscriptionAcompte: null,
  });
});

test("annuler un acompte : la fiche l'oublie, le montant part en contre-passation", () => {
  const e = eleve({ mensAcomptes: { Décembre: 30000 }, fraisAcomptes: { cantine: 100000 }, inscriptionAcompte: 20000 });
  assert.deepEqual(champsRetraitAcompte(e, { type: "mois", cle: "Décembre" }), { montant: 30000, champs: { mensAcomptes: {} } });
  assert.deepEqual(champsRetraitAcompte(e, { type: "frais", cle: "cantine" }), { montant: 100000, champs: { fraisAcomptes: {} } });
  assert.deepEqual(champsRetraitAcompte(e, { type: "inscription" }), { montant: 20000, champs: { inscriptionAcompte: null } });
});

// ── Tranches ──────────────────────────────────────────────────────────────
test("tranches proposées : 9 mois en 3×3, 10 mois en 4-3-3", () => {
  assert.deepEqual(proposerTranches(MOIS, 3).map((t) => [t.nom, periodeTranche(t)]), [
    ["1re tranche", "Octobre–Décembre"], ["2e tranche", "Janvier–Mars"], ["3e tranche", "Avril–Juin"],
  ]);
  const dix = ["Septembre", ...MOIS];
  assert.deepEqual(proposerTranches(dix, 3).map((t) => t.mois.length), [4, 3, 3]);
});

test("tranches valides : mois hors de l'année écartés, un mois dans une seule tranche", () => {
  const brutes = [
    { nom: "T1", mois: ["Septembre", "Octobre", "Novembre"] },   // Septembre n'est pas dans l'année
    { nom: "", mois: ["Novembre", "Décembre"] },                 // Novembre déjà pris
    { nom: "Vide", mois: ["Juillet"] },                          // disparaît
  ];
  const valides = tranchesValides(brutes, MOIS);
  assert.deepEqual(valides, [
    { nom: "T1", mois: ["Octobre", "Novembre"] },
    { nom: "2e tranche", mois: ["Décembre"] },
  ]);
  assert.equal(trancheDuMois(valides, "Décembre"), 1);
  assert.equal(trancheDuMois(valides, "Mars"), -1);
  assert.deepEqual(tranchesValides(undefined, MOIS), []);
});

test("répartition : les mois soldés ou dispensés sont sautés", () => {
  const etats = [
    { mois: "Octobre", reste: 0, verse: 110000 },
    { mois: "Novembre", reste: 110000, verse: 0 },
    { mois: "Décembre", reste: 50000, verse: 60000 },
  ];
  assert.deepEqual(repartirSurMois(etats, 200000), {
    affectations: [
      { mois: "Novembre", montant: 110000, solde: true, dejaVerse: 0 },
      { mois: "Décembre", montant: 50000, solde: true, dejaVerse: 60000 },
    ],
    nonAffecte: 40000,
  });
});

// ── Reçu et clôture ───────────────────────────────────────────────────────
test("le reçu compte les acomptes : lignes à part, dans les totaux", () => {
  const e = eleve({
    mens: { Octobre: "Payé" }, mensMontants: { Octobre: 110000 }, mensAcomptes: { Novembre: 30000 },
    inscriptionAcompte: 20000, fraisAcomptes: { cantine: 100000 },
  });
  const totals = getRecuTotals(e, 110000, MOIS, { inscription: 45000, divers: { cantine: 300000 } });
  assert.deepEqual(totals.moisAcomptes, [{ mois: "Novembre", montant: 30000 }]);
  assert.equal(totals.totalMensualites, 140000);
  assert.equal(totals.fraisIns, 20000);
  assert.equal(totals.insPartielle, true);
  assert.deepEqual(totals.fraisDiversPayes, [{ id: "cantine", label: "Cantine", montant: 100000, partiel: true }]);
  assert.equal(totals.totalGeneral, 140000 + 20000 + 100000);
});

test("clôture : les acomptes comptent comme paiements et repartent à zéro", () => {
  assert.equal(aDesPaiements({ mensAcomptes: { Octobre: 30000 } }), true);
  assert.equal(aDesPaiements({ fraisAcomptes: { cantine: 1 } }), true);
  assert.equal(aDesPaiements({ inscriptionAcompte: 5000 }), true);
  assert.equal(aDesPaiements({ mensAcomptes: {}, fraisAcomptes: {} }), false);
  const vierge = etatVierge(MOIS);
  assert.deepEqual([vierge.mensAcomptes, vierge.fraisAcomptes, vierge.inscriptionAcompte], [{}, {}, null]);
});

// ── Élève parti (règle des départs, cf. depart-utils) ─────────────────────
test("élève parti : seuls les mois entamés avant le départ se paient ; un acompte reste perçu", () => {
  const parti = eleve({ statut: "Transféré", dateDepart: "15/11/2026" });
  const etats = etatsMois(parti, MOIS, 110000, "2026-2027");
  assert.deepEqual(etats.slice(0, 3).map((e) => [e.mois, e.statut, e.reste]), [
    ["Octobre", "impaye", 110000], ["Novembre", "impaye", 110000], ["Décembre", "nonDu", 0],
  ]);
  const cible = { type: "mois", mois: MOIS };
  assert.equal(planVersement({ eleve: parti, cible, montant: 300000, mensualite: 110000, annee: "2026-2027" }).raison, "depasse");
  const plan = planVersement({ eleve: parti, cible, montant: 220000, mensualite: 110000, annee: "2026-2027" });
  assert.deepEqual(plan.moisSoldes, ["Octobre", "Novembre"]);

  // Acompte versé sur Décembre avant l'annonce du départ : perçu, pas dû.
  const avecAcompte = { ...parti, mensAcomptes: { Décembre: 30000 } };
  const snap = getEleveMensualiteSnapshot(avecAcompte, MOIS, TARIFS, "2026-2027");
  assert.equal(snap.montantMensualitesPercu, 30000);
  assert.equal(snap.soldeMensualites, 2 * 110000);
});
