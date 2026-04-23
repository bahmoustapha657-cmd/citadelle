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
