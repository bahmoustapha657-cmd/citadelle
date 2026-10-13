// Passerelle manuelle entre sections (bouton « 🌉 Passerelle » de l'écran
// Élèves) : on coche des élèves d'une section — d'ordinaire le préscolaire —
// et on choisit leur classe dans une autre. Le déplacement lui-même
// (changerSectionDoc) est couvert par changer-section.test.js ; ici, le choix
// des élèves, des sections, des classes d'arrivée et les refus.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

const ignore = typeof mock.module !== "function"
  && "mocks de modules absents : lancer avec --experimental-test-module-mocks";

const appels = [];
const echoue = new Set();
if (!ignore) {
  mock.module("../src/backend/data-supabase.js", {
    namedExports: {
      changerSectionDoc: async (ecole, collection, id, section, champs, options) => {
        if (echoue.has(id)) throw new Error("Déplacement refusé");
        appels.push({ ecole, collection, id, section, champs, options });
      },
    },
  });
}
const mod = ignore ? null : await import("../src/components/comptabilite/enrolment/passerelle.js");

test("élèves proposés : présents seulement, triés par classe puis nom", { skip: ignore }, () => {
  const liste = mod.elevesPasserelle([
    { _id: "1", nom: "BAH", prenom: "A", classe: "Petite Section A", statut: "Actif" },
    { _id: "2", nom: "DIALLO", prenom: "B", classe: "Grande Section A", statut: "Actif" },
    { _id: "3", nom: "CAMARA", prenom: "C", classe: "Grande Section A", statut: "Actif" },
    { _id: "4", nom: "SOW", prenom: "D", classe: "Grande Section A", statut: "Exclu" },
  ]);
  assert.deepEqual(liste.map((e) => e._id), ["3", "2", "1"]);
});

test("section d'arrivée par défaut : la suivante du cursus parmi les sections ouvertes", { skip: ignore }, () => {
  assert.equal(mod.sectionSuivante({}, "prescolaire"), "primaire");
  assert.equal(mod.sectionSuivante({ sectionsActives: ["prescolaire", "college"] }, "prescolaire"), "college");
  assert.equal(mod.sectionSuivante({ sectionsActives: ["prescolaire", "primaire"] }, "primaire"), "prescolaire");
});

test("classes d'arrivée : celles du système + celles créées, toutes de la section", { skip: ignore }, () => {
  const guineen = mod.classesArrivee({}, "primaire", [{ nom: "1ère Année E" }, "Grande Section D", { nom: "7ème Année A" }]);
  assert.ok(guineen.includes("1ère Année A"));
  assert.ok(guineen.includes("1ère Année E"));
  assert.ok(!guineen.includes("Grande Section D"));
  assert.ok(!guineen.includes("7ème Année A"));
  assert.equal(mod.classesArrivee({ systemeScolaire: "francophone" }, "primaire")[0], "CP A");
});

test("la passerelle range la fiche dans la section d'arrivée avec sa nouvelle classe, sur le serveur", { skip: ignore }, async () => {
  appels.length = 0;
  echoue.clear();
  echoue.add("b");
  const { passes, echecs } = await mod.appliquerPasserelle("citadelle", [{ _id: "a" }, { _id: "b" }],
    { depart: "prescolaire", arrivee: "primaire", classe: " 1ère Année A " });
  assert.deepEqual(passes.map((e) => e._id), ["a"]);
  assert.deepEqual(echecs.map((x) => x.eleve._id), ["b"]);
  assert.deepEqual(appels, [{
    ecole: "citadelle", collection: "elevesPrescolaire", id: "a", section: "primaire",
    champs: { classe: "1ère Année A" }, options: { reseau: true },
  }]);
});

test("classe hors section d'arrivée ou sections identiques : refus avant toute écriture", { skip: ignore }, async () => {
  appels.length = 0;
  for (const classe of ["Grande Section B", "7ème Année A", "", "  "]) {
    await assert.rejects(mod.appliquerPasserelle("citadelle", [{ _id: "a" }], { depart: "prescolaire", arrivee: "primaire", classe }));
  }
  await assert.rejects(mod.appliquerPasserelle("citadelle", [{ _id: "a" }], { depart: "primaire", arrivee: "primaire", classe: "1ère Année A" }));
  assert.equal(appels.length, 0);
});
