import assert from "node:assert/strict";
import test from "node:test";

import {
  classesEcarteesEcole, ecarterNonReinscrits, estNonReinscritSansPaiement, reglageEcartes, sansNonReinscritsEcartes,
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
  assert.deepEqual(sansNonReinscritsEcartes(tous, ecole).map((x) => x._id), ["x"]);
  // Année archivée sans réglage : personne n'est écarté.
  assert.deepEqual(sansNonReinscritsEcartes(tous, ecole, "2024-2025").map((x) => x._id), ["a", "x"]);
});

test("reglageEcartes : remplace l'année visée, garde les autres, efface une année vide", () => {
  const ecole = { ecartesNonReinscrits: { "2025-2026": ["CM2"] } };
  assert.deepEqual(reglageEcartes(ecole, "2026-2027", ["6e A", "6e A", "5e B"]), { "2025-2026": ["CM2"], "2026-2027": ["6e A", "5e B"] });
  assert.deepEqual(reglageEcartes(ecole, "2025-2026", []), {});
  assert.deepEqual(reglageEcartes({}, "2026-2027", ["6e A"]), { "2026-2027": ["6e A"] });
  // L'original n'est pas modifié.
  assert.deepEqual(ecole.ecartesNonReinscrits, { "2025-2026": ["CM2"] });
});
