import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSameParentHousehold,
  mergeParentStudentLinks,
  parentAccountsShareStudent,
} from "../api/_lib/account-links.js";

test("detects the same parent household when tutor and filiation match", () => {
  assert.equal(
    hasSameParentHousehold(
      { tuteur: "Mamadou Bah", filiation: "Pere", contactTuteur: "+224 620 00 00 01" },
      { tuteur: "mamadou  bah", filiation: "pere", contactTuteur: "620000001" },
    ),
    true,
  );
});

test("rejects household match when both phone numbers exist and differ", () => {
  assert.equal(
    hasSameParentHousehold(
      { tuteur: "Mamadou Bah", filiation: "Pere", contactTuteur: "+224 620 00 00 01" },
      { tuteur: "Mamadou Bah", filiation: "Pere", contactTuteur: "+224 621 99 99 99" },
    ),
    false,
  );
});

test("merges sibling links into one parent account", () => {
  const merged = mergeParentStudentLinks(
    {
      eleveId: "eleve-1",
      eleveNom: "Aminata Bah",
      eleveClasse: "6e A",
      section: "college",
      eleveIds: ["eleve-1"],
      elevesAssocies: [{ eleveId: "eleve-1", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" }],
      sections: ["college"],
    },
    {
      eleveId: "eleve-2",
      eleveNom: "Mariama Bah",
      eleveClasse: "4e B",
      section: "college",
      eleveIds: ["eleve-2"],
      elevesAssocies: [{ eleveId: "eleve-2", eleveNom: "Mariama Bah", eleveClasse: "4e B", section: "college" }],
      sections: ["college"],
    },
  );

  assert.deepEqual(merged.eleveIds, ["eleve-1", "eleve-2"]);
  assert.equal(merged.elevesAssocies.length, 2);
  assert.deepEqual(merged.sections, ["college"]);
});

test("detects when two parent accounts already share the same student", () => {
  assert.equal(
    parentAccountsShareStudent(
      { eleveId: "eleve-1", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" },
      { eleveIds: ["eleve-1"], elevesAssocies: [{ eleveId: "eleve-1", eleveNom: "Aminata Bah", eleveClasse: "6e A", section: "college" }] },
    ),
    true,
  );
});
