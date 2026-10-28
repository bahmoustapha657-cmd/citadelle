import assert from "node:assert/strict";
import test from "node:test";
import { rechercheActive, rechercherEleves, termesRecherche, termesSansResultat } from "../src/recherche-eleves.js";

const eleve = (id, extra = {}) => ({
  _id: id, nom: "Diallo", prenom: "Aïssatou", classe: "8e A", matricule: `C-25-00${id}`,
  filiation: "Mariama Bah", tuteur: "Mamadou Diallo", contactTuteur: "620 00 00 01", ...extra,
});
const ids = (liste) => liste.map((e) => e._id);

const ELEVES = [
  eleve("1"),
  eleve("2", { prenom: "Ibrahima", classe: "CP1", contactTuteur: "+224 620-00-00-01" }),
  eleve("3", { nom: "Camara", prenom: "Fatou", filiation: "Kadiatou Sow", tuteur: "Sékou Camara", contactTuteur: "655 12 34 56 / 621 99 88 77" }),
  eleve("4", { nom: "Barry", prenom: "Oumar", filiation: "Hawa Barry", tuteur: "Alpha Barry", contactTuteur: "" }),
];

test("sans saisie, la liste revient telle quelle", () => {
  assert.equal(rechercherEleves(ELEVES, "", "tout"), ELEVES);
  assert.equal(rechercherEleves(ELEVES, "  , ;", "matricule"), ELEVES);
  assert.equal(rechercheActive(" ,"), false);
  assert.equal(rechercheActive("bah"), true);
});

test("matricule : tirets, espaces et casse ignorés", () => {
  assert.deepEqual(ids(rechercherEleves(ELEVES, "C-25-003", "matricule")), ["3"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "c25003", "matricule")), ["3"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "c 25 004", "matricule")), ["4"]);
});

test("filiation : sans accents, dans n'importe quel ordre", () => {
  assert.deepEqual(ids(rechercherEleves(ELEVES, "BAH mariama", "filiation")), ["1", "2"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "kadiatou", "filiation")), ["3"]);
  // Le nom du tuteur n'est pas lu par ce critère.
  assert.deepEqual(ids(rechercherEleves(ELEVES, "Sékou", "filiation")), []);
});

test("nom du tuteur : réunit la fratrie, accents ignorés", () => {
  assert.deepEqual(ids(rechercherEleves(ELEVES, "diallo mamadou", "nomTuteur")), ["1", "2"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "sekou", "nomTuteur")), ["3"]);
});

test("numéro du tuteur : toutes les écritures, indicatif compris, chaque numéro de la fiche", () => {
  for (const saisie of ["620000001", "620 00 00 01", "+224 620 00 00 01", "00224620000001"]) {
    assert.deepEqual(ids(rechercherEleves(ELEVES, saisie, "telTuteur")), ["1", "2"], saisie);
  }
  // Second numéro de la fiche, et morceau de numéro.
  assert.deepEqual(ids(rechercherEleves(ELEVES, "621 99 88 77", "telTuteur")), ["3"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "998877", "telTuteur")), ["3"]);
  // Trop court ou sans chiffres : personne (pas toute l'école).
  assert.deepEqual(ids(rechercherEleves(ELEVES, "62", "telTuteur")), []);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "Diallo", "telTuteur")), []);
  // « 224 » seul ne désigne pas tous les numéros guinéens.
  assert.deepEqual(ids(rechercherEleves(ELEVES, "224", "telTuteur")), []);
});

test("tout : nom de l'élève, matricule, filiation, tuteur ou numéro", () => {
  assert.deepEqual(ids(rechercherEleves(ELEVES, "fatou", "tout")), ["3"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "c25004", "tout")), ["4"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "hawa", "tout")), ["4"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "alpha barry", "tout")), ["4"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "655 12 34 56", "tout")), ["3"]);
});

test("recherche collective : plusieurs termes, un élève retenu s'il répond à l'un d'eux", () => {
  assert.deepEqual(termesRecherche(" C-25-001 , C-25-004;\nC-25-009 "), ["C-25-001", "C-25-004", "C-25-009"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "C-25-001, C-25-004", "matricule")), ["1", "4"]);
  assert.deepEqual(ids(rechercherEleves(ELEVES, "620000001; 655123456", "telTuteur")), ["1", "2", "3"]);
  // L'ordre de la liste est gardé (le tri choisi se pose ensuite).
  assert.deepEqual(ids(rechercherEleves(ELEVES, "C-25-004, C-25-001", "matricule")), ["1", "4"]);
});

test("termes sans résultat : signalés en recherche collective seulement", () => {
  assert.deepEqual(termesSansResultat(ELEVES, "C-25-001, C-25-099, X", "matricule"), ["C-25-099", "X"]);
  assert.deepEqual(termesSansResultat(ELEVES, "C-25-099", "matricule"), []);
  assert.deepEqual(termesSansResultat(ELEVES, "", "matricule"), []);
});

test("fiches incomplètes et critère inconnu : pas d'erreur", () => {
  const liste = [{ _id: "x" }, null, eleve("1")];
  assert.deepEqual(ids(rechercherEleves(liste, "620000001", "telTuteur")), ["1"]);
  assert.deepEqual(ids(rechercherEleves(liste.filter(Boolean), "aissatou", "inconnu")), ["1"]);
});
