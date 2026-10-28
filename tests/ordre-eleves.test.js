import assert from "node:assert/strict";
import test from "node:test";
import { comparerClassesParNiveau } from "../src/constants.js";
import { lireTriEleves, nomAffiche, trierElevesAlpha } from "../src/ordre-eleves.js";
import { sortAlphaEleves } from "../src/components/comptabilite/eleves-helpers.js";

const ELEVES = [
  { _id: "1", nom: "BAH", prenom: "Mariama", classe: "6ème Année A" },
  { _id: "2", nom: "DIALLO", prenom: "Abdoulaye", classe: "10ème Année A" },
  { _id: "3", nom: "CAMARA", prenom: "Fatoumata", classe: "6ème Année A" },
  { _id: "4", nom: "SOW", prenom: "Aissatou", classe: "7ème Année A" },
];
const affichage = (liste, tri) => liste.map((e) => nomAffiche(e, tri));

test("le nom s'écrit dans l'ordre choisi, et la liste est triée sur ce qui est écrit", () => {
  assert.deepEqual(affichage(trierElevesAlpha(ELEVES, "prenom_nom"), "prenom_nom"),
    ["Abdoulaye DIALLO", "Aissatou SOW", "Fatoumata CAMARA", "Mariama BAH"]);
  assert.deepEqual(affichage(trierElevesAlpha(ELEVES, "nom_prenom"), "nom_prenom"),
    ["BAH Mariama", "CAMARA Fatoumata", "DIALLO Abdoulaye", "SOW Aissatou"]);
});

test("réglage absent ou inconnu : « NOM Prénom », celui des documents imprimés", () => {
  assert.equal(lireTriEleves(undefined), "nom_prenom");
  assert.equal(lireTriEleves("nom"), "nom_prenom");
  assert.equal(nomAffiche(ELEVES[0]), "BAH Mariama");
  assert.deepEqual(affichage(trierElevesAlpha(ELEVES)), ["BAH Mariama", "CAMARA Fatoumata", "DIALLO Abdoulaye", "SOW Aissatou"]);
  // Les listes de la compta passent par le même tri.
  assert.deepEqual(sortAlphaEleves(ELEVES), trierElevesAlpha(ELEVES));
});

test("par classe : les niveaux dans l'ordre (la 10ème après la 7ème), puis les noms", () => {
  assert.deepEqual(affichage(trierElevesAlpha(ELEVES, "classe_nom"), "classe_nom"),
    ["BAH Mariama", "CAMARA Fatoumata", "SOW Aissatou", "DIALLO Abdoulaye"]);
  assert.deepEqual(affichage(trierElevesAlpha(ELEVES, "classe_prenom"), "classe_prenom"),
    ["Fatoumata CAMARA", "Mariama BAH", "Aissatou SOW", "Abdoulaye DIALLO"]);
});

test("nom ou prénom manquant : pas d'espace en trop, pas de plantage", () => {
  assert.equal(nomAffiche({ nom: "BAH" }, "prenom_nom"), "BAH");
  assert.equal(nomAffiche({ prenom: " Aminata " }, "nom_prenom"), "Aminata");
  assert.equal(nomAffiche({}, "prenom_nom"), "");
  assert.doesNotThrow(() => trierElevesAlpha([{}, { nom: "BAH" }], "classe_nom"));
});

test("classes dans l'ordre des niveaux, système guinéen et francophone", () => {
  const trier = (classes) => [...classes].sort(comparerClassesParNiveau);
  assert.deepEqual(
    trier(["Terminale A", "10ème Année A", "Grande Section A", "1ère Année B", "1ère Année A", "6ème Année A", "11ème Année A", "Petite Section A", "7ème Année A"]),
    ["Petite Section A", "Grande Section A", "1ère Année A", "1ère Année B", "6ème Année A", "7ème Année A", "10ème Année A", "11ème Année A", "Terminale A"]);
  assert.deepEqual(
    trier(["Terminale", "6ème B", "CM2", "Seconde", "CP", "3ème", "Première", "CE1", "6ème A"]),
    ["CP", "CE1", "CM2", "6ème A", "6ème B", "3ème", "Seconde", "Première", "Terminale"]);
  // Classe libre : après les niveaux connus, en ordre naturel ; accents ignorés.
  assert.deepEqual(trier(["Atelier 10", "Atelier 2", "7eme annee A"]), ["7eme annee A", "Atelier 2", "Atelier 10"]);
});
