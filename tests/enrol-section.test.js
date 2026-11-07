// Formulaire élève : section au choix (comme la saisie rapide). À la
// modification, changer la section fait passer l'élève dans l'autre — ex.
// Grande Section A (préscolaire) → 1ère Année A (primaire). Le déplacement
// lui-même (changerSectionDoc) est couvert par changer-section.test.js ; ici,
// le contrôle de la classe et l'appel fait.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const appels = [];
if (!ignore) {
  mock.module("../src/backend/data-supabase.js", {
    namedExports: {
      changerSectionDoc: async (...args) => { appels.push(args); },
    },
  });
}
const mod = ignore ? null : await import("../src/components/comptabilite/enrolment/enrol-section.js");

test("la classe doit appartenir à la section choisie", { skip: ignore }, () => {
  assert.equal(mod.erreurClasseSection("1ère Année A", "primaire"), null);
  assert.equal(mod.erreurClasseSection("CP B", "primaire"), null);
  assert.equal(mod.erreurClasseSection("Grande Section A", "prescolaire"), null);
  assert.match(mod.erreurClasseSection("Grande Section A", "primaire"), /n'est pas une classe du Primaire/);
  assert.equal(mod.erreurClasseSection("", "primaire"), "Classe obligatoire");
});

test("le passage déplace la fiche avec sa nouvelle classe, sur le serveur", { skip: ignore }, async () => {
  appels.length = 0;
  await mod.deplacerEleve("citadelle", "e1", { depart: "prescolaire", arrivee: "primaire", classe: "1ère Année A" });
  assert.deepEqual(appels, [["citadelle", "elevesPrescolaire", "e1", "primaire", { classe: "1ère Année A" }, { reseau: true }]]);
});

test("classe hors de la section d'arrivée : refus avant toute écriture", { skip: ignore }, async () => {
  appels.length = 0;
  await assert.rejects(mod.deplacerEleve("citadelle", "e1", { depart: "prescolaire", arrivee: "primaire", classe: "Grande Section B" }));
  await assert.rejects(mod.deplacerEleve("citadelle", "e1", { depart: "inconnue", arrivee: "primaire", classe: "1ère Année A" }));
  assert.equal(appels.length, 0);
});
