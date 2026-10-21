import assert from "node:assert/strict";
import test from "node:test";
import {
  filiationManquante,
  findEnrollmentDuplicate,
  getEnrollmentDuplicateMessage,
  normalizeEnrollmentText,
  normalizeFiliation,
} from "../src/enrollment-utils.js";

test("duplicate detection matches IEN even with spacing or case changes", () => {
  const existing = [{ _id: "1", ien: " ien-42 ", nom: "Diallo", prenom: "Aminata" }];
  const duplicate = findEnrollmentDuplicate({ ien: "IEN-42" }, existing);

  assert.equal(duplicate?.type, "ien");
});

test("duplicate detection matches matricule before creating another record", () => {
  const existing = [{ _id: "1", matricule: "C25-001", nom: "Bah", prenom: "Moussa" }];
  const duplicate = findEnrollmentDuplicate({ matricule: " c25-001 " }, existing);

  assert.equal(duplicate?.type, "matricule");
});

test("duplicate detection matches same name and parentage, whatever the wording", () => {
  const existing = [{ _id: "1", nom: "Diallo", prenom: "Aminata", filiation: "Fille de Mamadou Diallo et de Aïssatou Bah" }];
  const duplicate = findEnrollmentDuplicate({
    nom: " diallo ",
    prenom: "AMINATA",
    filiation: "Père : Mamadou  DIALLO / Mère : Aissatou Bah",
  }, existing);

  assert.equal(duplicate?.type, "identity");
  assert.equal(normalizeEnrollmentText("  Eleve  Test "), "eleve test");
});

test("same name and parentage: two children only if both birth dates differ", () => {
  const existing = [{ _id: "1", nom: "Bah", prenom: "Moussa", filiation: "Alpha Bah et Hawa Sow", dateNaissance: "2014-01-02" }];
  const candidat = { nom: "Bah", prenom: "Moussa", filiation: "Alpha Bah et Hawa Sow" };

  assert.equal(findEnrollmentDuplicate({ ...candidat, dateNaissance: "2015-06-30" }, existing), null);
  assert.equal(findEnrollmentDuplicate({ ...candidat, dateNaissance: "2014-01-02" }, existing)?.type, "identity");
  assert.equal(findEnrollmentDuplicate(candidat, existing)?.type, "identity");
  assert.equal(
    findEnrollmentDuplicate({ ...candidat, dateNaissance: "2015-06-30" }, [{ ...existing[0], dateNaissance: "" }])?.type,
    "identity",
  );
});

test("homonyms with different parentage are two children", () => {
  const existing = [{ _id: "1", nom: "Diallo", prenom: "Ibrahima", filiation: "Thierno Diallo et Fanta Camara" }];
  const duplicate = findEnrollmentDuplicate(
    { nom: "Diallo", prenom: "Ibrahima", filiation: "Ousmane Diallo et Néné Barry" }, existing,
  );

  assert.equal(duplicate, null);
});

test("parentage is required: empty or only linking words counts as missing", () => {
  assert.equal(filiationManquante({ filiation: "" }), true);
  assert.equal(filiationManquante({ filiation: " Père : / Mère : " }), true);
  assert.equal(filiationManquante({ filiation: "Alpha Bah et Hawa Sow" }), false);
  assert.equal(normalizeFiliation("Fils de Alpha BAH et de Hawa Sow"), "alpha bah hawa sow");
});

test("duplicate detection ignores the current record while editing", () => {
  const existing = [{
    _id: "1",
    nom: "Bah",
    prenom: "Ibrahima",
    filiation: "Alpha Bah et Hawa Sow",
    ien: "ABC123",
  }];
  const duplicate = findEnrollmentDuplicate({
    _id: "1",
    nom: "Bah",
    prenom: "Ibrahima",
    filiation: "Alpha Bah et Hawa Sow",
    ien: "ABC123",
  }, existing, { excludeId: "1" });

  assert.equal(duplicate, null);
});

test("duplicate message stays readable for import and manual entry", () => {
  const duplicate = {
    type: "identity",
    student: { nom: "Bah", prenom: "Aicha", classe: "3ème Année B", matricule: "P26/465" },
  };

  assert.equal(
    getEnrollmentDuplicateMessage(duplicate, {}, { scope: "deja dans l'ecole" }),
    "Doublon detecte: Bah Aicha, meme filiation, est deja inscrit(e) (3ème Année B, matricule P26/465) (deja dans l'ecole).",
  );
});
