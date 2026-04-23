import assert from "node:assert/strict";
import test from "node:test";
import { findStaffDuplicate, getStaffDuplicateMessage } from "../src/staff-utils.js";

test("staff duplicate detection matches phone numbers even when formatted differently", () => {
  const existing = [{ _id: "1", nom: "Diallo", prenom: "Moussa", telephone: "622 00 00 01" }];
  const duplicate = findStaffDuplicate({ nom: "Barry", prenom: "Aicha", telephone: "+224622000001" }, existing);

  assert.equal(duplicate?.type, "phone");
});

test("staff duplicate detection matches same name and prenom", () => {
  const existing = [{ _id: "1", nom: "Bah", prenom: "Fatoumata", telephone: "" }];
  const duplicate = findStaffDuplicate({ nom: " bah ", prenom: "FAToumata" }, existing);

  assert.equal(duplicate?.type, "identity");
});

test("staff duplicate detection ignores the record being edited", () => {
  const existing = [{ _id: "1", nom: "Camara", prenom: "Ibrahima", telephone: "628000002" }];
  const duplicate = findStaffDuplicate(
    { _id: "1", nom: "Camara", prenom: "Ibrahima", telephone: "628000002" },
    existing,
    { excludeId: "1" },
  );

  assert.equal(duplicate, null);
});

test("staff duplicate messages stay readable", () => {
  assert.equal(
    getStaffDuplicateMessage({ type: "phone" }, { label: "cet enseignant" }),
    "Doublon detecte: ce numero est deja utilise pour cet enseignant.",
  );
  assert.equal(
    getStaffDuplicateMessage({ type: "identity" }, { label: "ce membre du personnel" }),
    "Doublon detecte: une fiche avec le meme nom et prenom existe deja pour ce membre du personnel.",
  );
});
