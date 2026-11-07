import assert from "node:assert/strict";
import test from "node:test";

import {
  DELAI_RETRAIT_DEFAUT, classesEcarteesEcole, dateRetraitNonReinscrits, delaiRetraitEcole, ecarterNonReinscrits,
  estNonReinscritSansPaiement, formaterDateRetrait, libelleDateRetrait, reglageEcartes, regleEcartement, retraitEnVigueur, sansNonReinscritsEcartes,
} from "../src/ecartes-non-reinscrits.js";

const e = (id, classe, extra = {}) => ({ _id: id, classe, statut: "Actif", inscriptionPayee: false, mens: {}, ...extra });

test("non réinscrit sans paiement : actif, inscription non encaissée, rien payé de l'année", () => {
  assert.equal(estNonReinscritSansPaiement(e("a", "6e A")), true);
  assert.equal(estNonReinscritSansPaiement(e("b", "6e A", { mens: { Octobre: "Payé" } })), false);
  assert.equal(estNonReinscritSansPaiement(e("c", "6e A", { mensAcomptes: { Octobre: 20000 } })), false);
  assert.equal(estNonReinscritSansPaiement(e("d", "6e A", { inscriptionAcompte: 5000 })), false);
  assert.equal(estNonReinscritSansPaiement(e("i", "6e A", { inscriptionPayee: true })), false);
  assert.equal(estNonReinscritSansPaiement(e("p", "6e A", { statut: "Abandonné" })), false);
});

test("écarter : seulement les classes choisies, les autres élèves restent", () => {
  const tous = [e("a", "6e A"), e("b", "6e A", { mens: { Octobre: "Payé" } }), e("i", "6e A", { inscriptionPayee: true }), e("x", "5e B")];
  const { gardes, ecartes } = ecarterNonReinscrits(tous, ["6e A"]);
  assert.deepEqual(ecartes.map((x) => x._id), ["a"]);
  assert.deepEqual(gardes.map((x) => x._id), ["b", "i", "x"]);
  assert.equal(ecarterNonReinscrits(tous, []).ecartes.length, 0);
});

test("réglage de l'école : par année, appliqué par sansNonReinscritsEcartes", () => {
  const ecole = { anneeScolaire: "2026-2027", ecartesNonReinscrits: { "2026-2027": ["6e A"], "2025-2026": ["CM2"] } };
  assert.deepEqual(classesEcarteesEcole(ecole), ["6e A"]);
  assert.deepEqual(classesEcarteesEcole(ecole, "2025-2026"), ["CM2"]);
  assert.deepEqual(classesEcarteesEcole({}), []);
  assert.deepEqual(classesEcarteesEcole({ anneeScolaire: "2026-2027", ecartesNonReinscrits: { "2026-2027": "6e A" } }), []);
  const tous = [e("a", "6e A"), e("x", "5e B")];
  // Avant le retrait automatique (1er novembre), seule la classe choisie.
  const rentree = new Date(2026, 9, 15);
  assert.deepEqual(sansNonReinscritsEcartes(tous, ecole, "2026-2027", rentree).map((x) => x._id), ["x"]);
  // Année archivée sans réglage : personne n'est écarté.
  assert.deepEqual(sansNonReinscritsEcartes(tous, ecole, "2024-2025", rentree).map((x) => x._id), ["a", "x"]);
});

test("reglageEcartes : remplace l'année visée, garde les autres, efface une année vide", () => {
  const ecole = { ecartesNonReinscrits: { "2025-2026": ["CM2"] } };
  assert.deepEqual(reglageEcartes(ecole, "2026-2027", ["6e A", "6e A", "5e B"]), { "2025-2026": ["CM2"], "2026-2027": ["6e A", "5e B"] });
  assert.deepEqual(reglageEcartes(ecole, "2025-2026", []), {});
  assert.deepEqual(reglageEcartes({}, "2026-2027", ["6e A"]), { "2026-2027": ["6e A"] });
  // L'original n'est pas modifié.
  assert.deepEqual(ecole.ecartesNonReinscrits, { "2025-2026": ["CM2"] });
});

test("non réinscrit : un dispensé de toute l'inscription n'en est jamais un", () => {
  assert.equal(estNonReinscritSansPaiement(e("d", "6e A", { exoneration: { inscription: 100, motif: "personnel" } })), false);
  // Une remise partielle ne l'inscrit pas d'office.
  assert.equal(estNonReinscritSansPaiement(e("r", "6e A", { exoneration: { inscription: 50 } })), true);
  // Un frais annexe payé suffit à le garder.
  assert.equal(estNonReinscritSansPaiement(e("f", "6e A", { fraisPayes: { tenue: "2026-10-03" } })), false);
});

test("date du retrait : début de l'année + délai, septembre ouvre l'année", () => {
  const iso = (d) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  assert.equal(iso(dateRetraitNonReinscrits("2026-2027", "Octobre", 1)), "2026-11-1");
  assert.equal(iso(dateRetraitNonReinscrits("2026-2027", "Octobre", 3)), "2027-1-1");
  assert.equal(iso(dateRetraitNonReinscrits("2026-2027", "Septembre", 1)), "2026-10-1");
  assert.equal(iso(dateRetraitNonReinscrits("2026-2027", "Janvier", 2)), "2027-3-1");
  assert.equal(dateRetraitNonReinscrits("2026-2027", "Octobre", 0), null);
  assert.equal(dateRetraitNonReinscrits("2026", "Octobre", 1), null);
});

test("délai de l'école : 1 mois par défaut, 0 = jamais, valeurs hors bornes ignorées", () => {
  assert.equal(delaiRetraitEcole({}), DELAI_RETRAIT_DEFAUT);
  assert.equal(delaiRetraitEcole({ retraitNonReinscrits: 0 }), 0);
  assert.equal(delaiRetraitEcole({ retraitNonReinscrits: 2 }), 2);
  assert.equal(delaiRetraitEcole({ retraitNonReinscrits: 7 }), DELAI_RETRAIT_DEFAUT);
  assert.equal(delaiRetraitEcole({ retraitNonReinscrits: "2" }), DELAI_RETRAIT_DEFAUT);
});

test("retrait automatique : toutes les classes passé le délai, l'année officielle seulement", () => {
  const ecole = { anneeScolaire: "2026-2027", moisDebut: "Octobre" };
  const avant = new Date(2026, 9, 31, 23, 59);
  const apres = new Date(2026, 10, 1, 0, 0);
  assert.equal(retraitEnVigueur(ecole, "2026-2027", avant), false);
  assert.equal(retraitEnVigueur(ecole, "2026-2027", apres), true);
  // Année close consultée : jamais.
  assert.equal(retraitEnVigueur(ecole, "2025-2026", apres), false);
  // Règle coupée par l'école.
  assert.equal(retraitEnVigueur({ ...ecole, retraitNonReinscrits: 0 }, "2026-2027", apres), false);
  // Délai de deux mois.
  assert.equal(retraitEnVigueur({ ...ecole, retraitNonReinscrits: 2 }, "2026-2027", apres), false);
  // École sans année officielle enregistrée : l'année passée fait foi.
  assert.equal(retraitEnVigueur({ moisDebut: "Octobre" }, "2026-2027", apres), true);

  const tous = [
    e("a", "6e A"), e("b", "5e B"), e("p", "5e B", { mens: { Novembre: "Payé" } }),
    e("d", "5e B", { exoneration: { inscription: 100 } }), e("s", "5e B", { statut: "Transféré" }),
  ];
  const regle = regleEcartement(ecole, "2026-2027", apres);
  assert.deepEqual(regle, { toutes: true, classes: [] });
  const { gardes, ecartes } = ecarterNonReinscrits(tous, regle);
  assert.deepEqual(ecartes.map((x) => x._id), ["a", "b"]);
  assert.deepEqual(gardes.map((x) => x._id), ["p", "d", "s"]);
  assert.deepEqual(sansNonReinscritsEcartes(tous, ecole, "2026-2027", avant).map((x) => x._id), ["a", "b", "p", "d", "s"]);
  assert.deepEqual(sansNonReinscritsEcartes(tous, ecole, "2026-2027", apres).map((x) => x._id), ["p", "d", "s"]);
  // Avant le délai, l'écartement manuel par classe reste possible.
  const manuel = { ...ecole, ecartesNonReinscrits: { "2026-2027": ["6e A"] } };
  assert.deepEqual(sansNonReinscritsEcartes(tous, manuel, "2026-2027", avant).map((x) => x._id), ["b", "p", "d", "s"]);
});

test("libellé de la date de retrait", () => {
  assert.equal(libelleDateRetrait(new Date(2026, 10, 1)), "le 1er novembre 2026");
  assert.equal(libelleDateRetrait(new Date(2027, 0, 1)), "le 1er janvier 2027");
  assert.equal(libelleDateRetrait(null), "");
  assert.equal(formaterDateRetrait(new Date(2026, 10, 3)), "3 novembre 2026");
  assert.equal(formaterDateRetrait(new Date(2026, 10, 1), "en"), "November 1, 2026");
});
