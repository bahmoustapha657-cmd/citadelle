import assert from "node:assert/strict";
import test from "node:test";
import { findLogicalAccountConflict } from "../api/_lib/account-conflicts.js";

test("blocks a second parent account for the same student id", () => {
  const conflict = findLogicalAccountConflict(
    [{ role: "parent", eleveId: "eleve-1", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" }],
    { role: "parent", eleveId: "eleve-1", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" },
  );

  assert.equal(conflict?.type, "parent");
  assert.equal(conflict?.error, "Un compte parent existe deja pour cet eleve.");
});

test("blocks legacy parent duplicates when student id is missing on one side", () => {
  const conflict = findLogicalAccountConflict(
    [{ role: "parent", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" }],
    { role: "parent", eleveId: "eleve-1", eleveNom: "aminata  bah", eleveClasse: "6e a", section: "college" },
  );

  assert.equal(conflict?.type, "parent");
});

test("blocks a second teacher account for the same teacher id", () => {
  const conflict = findLogicalAccountConflict(
    [{ role: "enseignant", enseignantId: "ens-1", enseignantNom: "Moussa Diallo", section: "college", matiere: "Maths" }],
    { role: "enseignant", enseignantId: "ens-1", enseignantNom: "Moussa Diallo", section: "college", matiere: "Maths" },
  );

  assert.equal(conflict?.type, "enseignant");
  assert.equal(conflict?.error, "Un compte enseignant existe deja pour cette fiche.");
});

test("blocks legacy teacher duplicates when old accounts do not have teacher id", () => {
  const conflict = findLogicalAccountConflict(
    [{ role: "enseignant", enseignantNom: "Moussa Diallo", section: "college", matiere: "Maths" }],
    { role: "enseignant", enseignantId: "ens-1", enseignantNom: "moussa diallo", section: "college", matiere: "maths" },
  );

  assert.equal(conflict?.type, "enseignant");
});

test("allows different students and different teachers", () => {
  const parentConflict = findLogicalAccountConflict(
    [{ role: "parent", eleveId: "eleve-1", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" }],
    { role: "parent", eleveId: "eleve-2", eleveNom: "Mariama Bah", eleveClasse: "6e A", section: "college" },
  );
  const teacherConflict = findLogicalAccountConflict(
    [{ role: "enseignant", enseignantId: "ens-1", enseignantNom: "Moussa Diallo", section: "college", matiere: "Maths" }],
    { role: "enseignant", enseignantId: "ens-2", enseignantNom: "Mamadou Barry", section: "college", matiere: "SVT" },
  );

  assert.equal(parentConflict, null);
  assert.equal(teacherConflict, null);
});
