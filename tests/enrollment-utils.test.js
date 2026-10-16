import assert from "node:assert/strict";
import test from "node:test";
import {
  findEnrollmentDuplicate,
  getEnrollmentDuplicateMessage,
  normalizeEnrollmentText,
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

test("duplicate detection matches same identity with normalized names", () => {
  const existing = [{
    _id: "1",
    nom: "Diallo",
    prenom: "Aminata",
    dateNaissance: "2012-03-15",
  }];
  const duplicate = findEnrollmentDuplicate({
    nom: " diallo ",
    prenom: "AMINATA",
    dateNaissance: "2012-03-15",
  }, existing);

  assert.equal(duplicate?.type, "identity");
  assert.equal(normalizeEnrollmentText("  Eleve  Test "), "eleve test");
});

test("duplicate detection ignores the current record while editing", () => {
  const existing = [{
    _id: "1",
    nom: "Bah",
    prenom: "Ibrahima",
    dateNaissance: "2011-07-22",
    ien: "ABC123",
  }];
  const duplicate = findEnrollmentDuplicate({
    _id: "1",
    nom: "Bah",
    prenom: "Ibrahima",
    dateNaissance: "2011-07-22",
    ien: "ABC123",
  }, existing, { excludeId: "1" });

  assert.equal(duplicate, null);
});

test("duplicate message stays readable for import and manual entry", () => {
  const duplicate = {
    type: "identity",
    student: { nom: "Bah", prenom: "Aicha" },
  };

  assert.equal(
    getEnrollmentDuplicateMessage(duplicate, {}, { scope: "deja dans l'ecole" }),
    "Doublon detecte: meme nom, prenom et date de naissance (deja dans l'ecole).",
  );
});

test("creation: a same-name student without birth date is a duplicate", () => {
  const existing = [{ _id: "1", nom: "DIALLO", prenom: "Adama", classe: "3ème Année B", matricule: "P26/465" }];
  const duplicate = findEnrollmentDuplicate({ nom: "Diallo", prenom: " adama " }, existing, { homonymes: true });

  assert.equal(duplicate?.type, "homonyme");
  assert.match(getEnrollmentDuplicateMessage(duplicate, {}), /3ème Année B, matricule P26\/465/);
});

test("creation: a birth date on one side only does not separate homonyms", () => {
  const existing = [{ _id: "1", nom: "Bah", prenom: "Moussa" }];
  const duplicate = findEnrollmentDuplicate(
    { nom: "Bah", prenom: "Moussa", dateNaissance: "2014-01-02" }, existing, { homonymes: true },
  );

  assert.equal(duplicate?.type, "homonyme");
});

test("creation: homonyms with different birth dates are two children", () => {
  const existing = [{ _id: "1", nom: "Diallo", prenom: "Ibrahima", dateNaissance: "2013-05-01" }];
  const duplicate = findEnrollmentDuplicate(
    { nom: "Diallo", prenom: "Ibrahima", dateNaissance: "2016-09-20" }, existing, { homonymes: true },
  );

  assert.equal(duplicate, null);
});

test("edit: existing homonyms without birth date stay editable", () => {
  const existing = [
    { _id: "1", nom: "Diallo", prenom: "Ibrahima" },
    { _id: "2", nom: "Diallo", prenom: "Ibrahima" },
  ];
  const duplicate = findEnrollmentDuplicate({ ...existing[0], classe: "4ème" }, existing, { excludeId: "1" });

  assert.equal(duplicate, null);
});
