import assert from "node:assert/strict";
import test from "node:test";

import {
  TOUTES_SECTIONS, elevesAffiches, mensualitesClassiques, sectionAffichee, sectionDeEleve, sectionEcriture, sectionsMensualites,
  toutProposable,
} from "../src/components/comptabilite/mensualites-tab/toutes-sections.js";

const ecole = (sectionsActives) => ({ sectionsActives });
const PAR_SECTION = {
  college: [{ _id: "c1" }, { _id: "c2" }],
  lycee: [{ _id: "l1" }],
  primaire: [{ _id: "p1" }],
  prescolaire: [{ _id: "m1" }],
};

test("« Tout » proposé dès deux sections ouvertes", () => {
  assert.equal(toutProposable(ecole(["primaire", "college"])), true);
  assert.equal(toutProposable(ecole(["primaire"])), false);
  // Aucune section déclarée : toutes ouvertes.
  assert.equal(toutProposable({}), true);
  assert.deepEqual(sectionsMensualites(ecole(["prescolaire", "college"])), ["college", "prescolaire"]);
});

test("sectionAffichee : « Tout » s'il est proposable, sinon une section ouverte", () => {
  assert.equal(sectionAffichee(ecole(["primaire", "college"]), TOUTES_SECTIONS), TOUTES_SECTIONS);
  assert.equal(sectionAffichee(ecole(["primaire"]), TOUTES_SECTIONS), "primaire");
  assert.equal(sectionAffichee(ecole(["primaire", "college"]), "college"), "college");
  assert.equal(sectionAffichee(ecole(["primaire", "college"]), "lycee"), "primaire");
});

test("école à l'onglet Mensualités d'origine (code « citadelle ») : jamais de « Tout »", () => {
  const deuxSections = ecole(["primaire", "college"]);
  assert.equal(mensualitesClassiques("citadelle"), true);
  assert.equal(mensualitesClassiques("autre-ecole"), false);
  assert.equal(mensualitesClassiques(undefined), false);
  assert.equal(toutProposable(deuxSections, "citadelle"), false);
  assert.equal(toutProposable(deuxSections, "autre-ecole"), true);
  // Un « Tout » resté choisi retombe sur une section ouverte.
  assert.equal(sectionAffichee(deuxSections, TOUTES_SECTIONS, "citadelle"), "primaire");
  assert.equal(sectionAffichee(deuxSections, TOUTES_SECTIONS, "autre-ecole"), TOUTES_SECTIONS);
});

test("elevesAffiches : « Tout » = les élèves des sections ouvertes seulement", () => {
  const ids = (liste) => liste.map((e) => e._id);
  assert.deepEqual(ids(elevesAffiches(PAR_SECTION, TOUTES_SECTIONS, ecole(["primaire", "college"]))), ["c1", "c2", "p1"]);
  assert.deepEqual(ids(elevesAffiches(PAR_SECTION, TOUTES_SECTIONS, {})), ["c1", "c2", "l1", "p1", "m1"]);
  assert.deepEqual(ids(elevesAffiches(PAR_SECTION, "lycee", {})), ["l1"]);
  assert.deepEqual(elevesAffiches(PAR_SECTION, "inconnue", {}), []);
});

test("sectionEcriture : un paiement s'écrit dans la section de l'élève, jamais dans « Tout »", () => {
  assert.equal(sectionDeEleve(PAR_SECTION, "p1"), "primaire");
  assert.equal(sectionDeEleve(PAR_SECTION, "absent"), null);
  assert.equal(sectionDeEleve(PAR_SECTION, ""), null);
  // Vue « Tout » : un élève du primaire s'écrit au primaire.
  assert.equal(sectionEcriture(PAR_SECTION, "p1", TOUTES_SECTIONS), "primaire");
  assert.equal(sectionEcriture(PAR_SECTION, "m1", TOUTES_SECTIONS), "prescolaire");
  // Élève introuvable : aucune collection en vue « Tout », la section affichée sinon.
  assert.equal(sectionEcriture(PAR_SECTION, "absent", TOUTES_SECTIONS), null);
  assert.equal(sectionEcriture(PAR_SECTION, "absent", "college"), "college");
});
