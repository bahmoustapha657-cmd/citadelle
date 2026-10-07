import assert from "node:assert/strict";
import test from "node:test";

import {
  cibleDepuisAnnonce, classesDesParents, destinatairesAnnonce, estParent, libelleCibleAnnonce,
  peutCreerGroupe, peutPublierAnnonce, postesDeLAnnuaire,
} from "../src/components/messagerie/messagerie-logic.js";

// Annuaire du Fondateur après messagerie-parents.sql : les parents portent
// `enfants` (section, classe) — ceux des élèves sortis n'y figurent plus.
const liste = [
  { id: "moi", role: "direction", poste_cle: "direction", poste: "Fondateur" },
  { id: "e1", role: "enseignant", poste_cle: "enseignant", poste: "Enseignant · Maths" },
  { id: "c1", role: "comptable", poste_cle: "comptable", poste: "Comptable" },
  { id: "p1", role: "parent", poste_cle: "parent", poste: "Parent · Awa Diallo (6ème A)",
    enfants: [{ section: "college", classe: "6ème A", nom: "Awa Diallo" }] },
  { id: "p2", role: "parent", poste_cle: "parent", poste: "Parent · Ousmane Barry (CM1)",
    enfants: [{ section: "primaire", classe: "CM1", nom: "Ousmane Barry" }] },
  { id: "p3", role: "parent", poste_cle: "parent", poste: "Parent · …",
    enfants: [{ section: "lycee", classe: "11ème SM", nom: "Fatou Sow" }, { section: "prescolaire", classe: "Petite section", nom: "Bobo Sow" }] },
  { id: "p4", role: "parent", poste_cle: "parent", poste: "Parent", enfants: [] },
];
const ids = (cible) => destinatairesAnnonce(cible, liste, "moi").map((c) => c.id);

test("parents : messagerie ouverte, sans groupe ni publication d'annonce", () => {
  const parent = { compteDocId: "x", role: "parent" };
  assert.equal(estParent(parent), true);
  assert.equal(peutPublierAnnonce(parent), false);
  assert.equal(peutCreerGroupe(parent), false);
  assert.equal(peutCreerGroupe({ compteDocId: "x", role: "enseignant" }), true);
  assert.equal(peutPublierAnnonce({ compteDocId: "x", role: "comptable" }), true);
});

test("annonces : « Toute l'équipe », le personnel et les postes ne visent jamais les parents", () => {
  assert.deepEqual(ids({ tous: true }), ["e1", "c1"]);
  assert.deepEqual(ids({ personnel: true }), ["c1"]);
  assert.deepEqual(ids({ postes: ["parent"] }), []);
});

test("annonces : tous les parents = ceux qui ont un enfant actuel", () => {
  assert.deepEqual(ids({ parents: true }), ["p1", "p2", "p3"]);
  assert.deepEqual(ids({ tous: true, parents: true }), ["e1", "c1", "p1", "p2", "p3"]);
});

test("annonces : parents d'une section, d'une classe, ou un parent choisi", () => {
  assert.deepEqual(ids({ parentsSections: ["prescolaire"] }), ["p3"]);
  assert.deepEqual(ids({ parentsSections: ["college", "primaire"] }), ["p1", "p2"]);
  assert.deepEqual(ids({ parentsClasses: ["primaire|CM1"] }), ["p2"]);
  assert.deepEqual(ids({ parentsClasses: ["college|CM1"] }), [], "la clé porte la section");
  assert.deepEqual(ids({ comptes: ["p4"] }), ["p4"]);
});

test("annonces : classes des enfants, par section puis par classe, avec le nombre de parents", () => {
  const classes = classesDesParents([...liste,
    { id: "p5", role: "parent", enfants: [{ section: "college", classe: "6ème A", nom: "Saliou" }] }]);
  assert.deepEqual(classes.map((c) => [c.cle, c.parents]), [
    ["prescolaire|Petite section", 1],
    ["primaire|CM1", 1],
    ["college|6ème A", 2],
    ["lycee|11ème SM", 1],
  ]);
});

test("annonces : libellé des cibles et relecture depuis la base", () => {
  const annonce = {
    a_tous: true, a_parents: false, a_parents_sections: ["prescolaire"], a_parents_classes: ["college|6ème A"],
    a_comptes: ["p1"],
  };
  const annuaire = new Map(liste.map((c) => [c.id, { ...c, nom: c.id === "p1" ? "Mariama Diallo" : c.id }]));
  assert.equal(libelleCibleAnnonce(annonce, annuaire),
    "Toute l'équipe, Parents — Maternelle, Parents — 6ème A, Mariama Diallo");
  assert.equal(libelleCibleAnnonce({ a_parents: true }, annuaire), "Tous les parents");
  assert.deepEqual(cibleDepuisAnnonce({ a_parents: true }), {
    tous: undefined, personnel: undefined, enseignants: undefined, postes: [], comptes: [],
    parents: true, parentsSections: [], parentsClasses: [],
  });
});

test("annonces : les parents ne deviennent pas un « poste » ciblable", () => {
  assert.deepEqual([...postesDeLAnnuaire(liste).keys()], ["direction", "comptable"]);
});
