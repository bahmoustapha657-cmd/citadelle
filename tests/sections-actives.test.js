// Sections déclarées dans Paramètres → Identité : une école qui n'a pas une
// section (La Citadelle n'a pas de lycée) ne doit la voir nulle part — menu,
// filtres, sélecteurs, tableau de bord, paie. Ces helpers font la règle.
import test from "node:test";
import assert from "node:assert/strict";
import {
  getSectionsActives, isGroupeActif, isModuleOuvertPourEcole, sectionOuverte,
} from "../src/constants.js";
import { sectionsPaieProposees } from "../src/components/comptabilite/salaires/bon-agents.js";
import { sectionsEnsOuvertes } from "../src/components/comptabilite/enseignants-tab/use-enseignants-tab.js";
import { buildFormInitial } from "../src/components/parametres/use-parametres/parametres-config.js";

const CITADELLE = { sectionsActives: ["prescolaire", "primaire", "college"] };
const PRIMAIRE_SEUL = { sectionsActives: ["prescolaire", "primaire"] };
const SECONDAIRE_SEUL = { sectionsActives: ["college", "lycee"] };

test("réglage absent, vide, invalide ou schoolInfo nul : toutes les sections", () => {
  const toutes = ["prescolaire", "primaire", "college", "lycee"];
  assert.deepEqual(getSectionsActives({}), toutes);
  assert.deepEqual(getSectionsActives({ sectionsActives: [] }), toutes);
  assert.deepEqual(getSectionsActives({ sectionsActives: ["inconnue"] }), toutes);
  assert.deepEqual(getSectionsActives(null), toutes);
  assert.deepEqual(getSectionsActives(undefined), toutes);
});

test("groupe ouvert dès qu'une de ses sections l'est", () => {
  assert.equal(isGroupeActif(CITADELLE, "primaire"), true);
  assert.equal(isGroupeActif(CITADELLE, "secondaire"), true); // collège sans lycée
  assert.equal(isGroupeActif(PRIMAIRE_SEUL, "secondaire"), false);
  assert.equal(isGroupeActif(SECONDAIRE_SEUL, "primaire"), false);
  assert.equal(isGroupeActif({ sectionsActives: ["prescolaire"] }, "primaire"), true);
  assert.equal(isGroupeActif({}, "secondaire"), true);
});

test("menu : Secondaire disparaît sans collège ni lycée, Dir. Primaire sans maternelle ni primaire", () => {
  assert.equal(isModuleOuvertPourEcole("secondaire", PRIMAIRE_SEUL), false);
  assert.equal(isModuleOuvertPourEcole("primaire", SECONDAIRE_SEUL), false);
  assert.equal(isModuleOuvertPourEcole("secondaire", CITADELLE), true);
  // Les autres modules ne dépendent d'aucune section.
  for (const moduleId of ["accueil", "compta", "statistiques", "parametres", "discipline"]) {
    assert.equal(isModuleOuvertPourEcole(moduleId, PRIMAIRE_SEUL), true, moduleId);
  }
});

test("sélecteur de section : le choix s'il est ouvert, sinon primaire/collège avant lycée et maternelle", () => {
  assert.equal(sectionOuverte(CITADELLE, "college"), "college");
  assert.equal(sectionOuverte(CITADELLE, "lycee"), "primaire");
  // Défaut historique « college » dans une école primaire : on ouvre le primaire, pas la maternelle.
  assert.equal(sectionOuverte(PRIMAIRE_SEUL, "college"), "primaire");
  assert.equal(sectionOuverte(SECONDAIRE_SEUL, "primaire"), "college");
  assert.equal(sectionOuverte({ sectionsActives: ["lycee"] }, "college"), "lycee");
  assert.equal(sectionOuverte({ sectionsActives: ["prescolaire"] }, "primaire"), "prescolaire");
  assert.equal(sectionOuverte({}, "lycee"), "lycee");
});

test("paie : pas de section Secondaire proposée sans secondaire — sauf la fiche ouverte", () => {
  assert.deepEqual(sectionsPaieProposees({ secondaire: true, primaire: true }), ["Secondaire", "Primaire", "Personnel"]);
  assert.deepEqual(sectionsPaieProposees({ secondaire: false, primaire: true }), ["Primaire", "Personnel"]);
  assert.deepEqual(sectionsPaieProposees({ secondaire: true, primaire: false }), ["Secondaire", "Personnel"]);
  // Un bon déjà classé « Secondaire » garde sa section dans le sélecteur.
  assert.deepEqual(sectionsPaieProposees({ secondaire: false, primaire: true }, "Secondaire"), ["Secondaire", "Primaire", "Personnel"]);
  // Sans information : tout, comme avant.
  assert.deepEqual(sectionsPaieProposees(), ["Secondaire", "Primaire", "Personnel"]);
});

test("enseignants (compta) : cartes et choix limités aux sections ouvertes", () => {
  assert.deepEqual(sectionsEnsOuvertes(CITADELLE), ["Primaire", "Collège"]);
  assert.deepEqual(sectionsEnsOuvertes(SECONDAIRE_SEUL), ["Collège", "Lycée"]);
  assert.deepEqual(sectionsEnsOuvertes({}), ["Primaire", "Collège", "Lycée"]);
  // Maternelle seule : « Primaire » reste — tout autre libellé partirait au lycée.
  assert.deepEqual(sectionsEnsOuvertes({ sectionsActives: ["prescolaire"] }), ["Primaire"]);
});

test("Paramètres : une école sans réglage voit toutes les sections cochées, maternelle comprise", () => {
  assert.deepEqual(buildFormInitial({}).sectionsActives, ["prescolaire", "primaire", "college", "lycee"]);
  assert.deepEqual(buildFormInitial(CITADELLE).sectionsActives, ["prescolaire", "primaire", "college"]);
});
