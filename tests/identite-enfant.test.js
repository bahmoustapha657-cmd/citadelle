import assert from "node:assert/strict";
import test from "node:test";
import {
  champsSeancePhoto, correspondEnfant, couleurClasse, fileSeancePhoto, grouperParClasse,
  initiales, nettoyerSurnom, nomAppel, nomOfficiel, SURNOM_MAX, trierParNomAppel,
} from "../src/identite-enfant.js";

// Une classe de maternelle comme à La Citadelle : prénoms et noms qui se
// répètent, des surnoms pour certains seulement.
const NENE = { _id: "1", nom: "Bah", prenom: "Fatoumata", surnom: "Néné", classe: "Petite Section A", tuteur: "Mamadou Bah", filiation: "Fille de Mamadou et de Aïssatou" };
const FATOU = { _id: "2", nom: "Bah", prenom: "Fatoumata", classe: "Petite Section A", photo: "https://x/photo2.jpg" };
const BOBO = { _id: "3", nom: "Diallo", prenom: "Mamadou", surnom: "  Bobo  ", classe: "Grande Section A", matricule: "PRE-003" };
const IBRAHIMA = { _id: "4", nom: "Camara", prenom: "Ibrahima", classe: "Petite Section B" };

test("nom d'appel : surnom s'il est renseigné, sinon prénom ; nom officiel NOM Prénom", () => {
  assert.equal(nomAppel(NENE), "Néné");
  assert.equal(nomAppel(FATOU), "Fatoumata");
  assert.equal(nomAppel(BOBO), "Bobo");
  assert.equal(nomAppel({ nom: "Sow" }), "Sow");
  assert.equal(nomAppel({}), "?");
  assert.equal(nomAppel({ prenom: "Awa", surnom: "   " }), "Awa");
  assert.equal(nomOfficiel(NENE), "BAH Fatoumata");
  assert.equal(nomOfficiel({ prenom: "Awa" }), "Awa");
  assert.equal(initiales(NENE), "FB");
  assert.equal(initiales({ surnom: "Baby" }), "B");
});

test("surnom nettoyé : espaces resserrés, longueur bornée", () => {
  assert.equal(nettoyerSurnom("  Néné   la  petite "), "Néné la petite");
  assert.equal(nettoyerSurnom(null), "");
  assert.equal(nettoyerSurnom("x".repeat(50)).length, SURNOM_MAX);
});

test("recherche : sans accents, mots dans le désordre, surnom, parent, matricule", () => {
  assert.ok(correspondEnfant(NENE, "nene"));
  assert.ok(correspondEnfant(NENE, "fatou bah"));
  assert.ok(correspondEnfant(NENE, "BAH fatoumata"));
  assert.ok(correspondEnfant(NENE, "aissatou"), "filiation");
  assert.ok(correspondEnfant(NENE, "mamadou"), "tuteur");
  assert.ok(correspondEnfant(BOBO, "pre-003"));
  assert.ok(correspondEnfant(BOBO, ""));
  assert.ok(!correspondEnfant(FATOU, "nene"));
  assert.ok(!correspondEnfant(IBRAHIMA, "bah"));
});

test("tri et regroupement : classes dans l'ordre, enfants par nom d'appel", () => {
  assert.deepEqual(trierParNomAppel([NENE, FATOU, BOBO]).map((e) => e._id), ["3", "2", "1"]);
  const groupes = grouperParClasse([BOBO, IBRAHIMA, NENE, FATOU, { _id: "5", prenom: "Awa" }]);
  assert.deepEqual(groupes.map(([classe]) => classe),
    ["Grande Section A", "Petite Section A", "Petite Section B", "Sans classe"]);
  assert.deepEqual(groupes[1][1].map((e) => e._id), ["2", "1"]);
});

test("couleur par niveau de maternelle, couleur de l'école ailleurs", () => {
  assert.equal(couleurClasse("Petite Section A"), "#ea580c");
  assert.equal(couleurClasse("moyenne section B"), "#16a34a");
  assert.equal(couleurClasse("Grande Section A"), "#2563eb");
  assert.equal(couleurClasse("1ère Année A", "#123456"), "#123456");
  assert.equal(couleurClasse(undefined), "#0A1628");
});

test("séance photo : file figée par classe, sans photo d'abord demandée, ordre officiel", () => {
  const tous = [FATOU, NENE, IBRAHIMA, BOBO];
  // FATOU a déjà sa photo : écartée par défaut, sauf si on l'a choisie.
  assert.deepEqual(fileSeancePhoto(tous, { classe: "Petite Section A" }), ["1"]);
  assert.deepEqual(fileSeancePhoto(tous, { classe: "Petite Section A", inclure: "2" }), ["2", "1"]);
  assert.deepEqual(fileSeancePhoto(tous, { classe: "Petite Section A", seulementSansPhoto: false }), ["2", "1"]);
  assert.deepEqual(fileSeancePhoto(tous, {}), ["1", "4", "3"]);
});

test("séance photo : seuls les champs qui changent partent", () => {
  assert.deepEqual(champsSeancePhoto(NENE, { surnom: " Néné " }), {});
  assert.deepEqual(champsSeancePhoto(NENE, { surnom: "Nénette" }), { surnom: "Nénette" });
  assert.deepEqual(champsSeancePhoto(NENE, { surnom: "" }), { surnom: "" });
  assert.deepEqual(champsSeancePhoto(FATOU, { photo: "https://x/photo2.jpg" }), {});
  assert.deepEqual(champsSeancePhoto(FATOU, { photo: "https://x/nouvelle.jpg", surnom: "Fatou" }),
    { photo: "https://x/nouvelle.jpg", surnom: "Fatou" });
});
