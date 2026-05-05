import assert from "node:assert/strict";
import test from "node:test";
import { resolveParentLegacyLinks } from "../api/_lib/parent-links-migration.js";

test("resolveParentLegacyLinks upgrades a unique legacy student match to eleveId", () => {
  const migration = resolveParentLegacyLinks({
    account: {
      role: "parent",
      section: "college",
      elevesAssocies: [{
        eleveNom: "Aminata Bah",
        eleveClasse: "6e A",
        section: "college",
      }],
    },
    studentsByClass: {
      "college|6e a": [{
        _id: "eleve-1",
        prenom: "Aminata",
        nom: "Bah",
        classe: "6e A",
        section: "college",
      }],
    },
  });

  assert.equal(migration.didUpdate, true);
  assert.equal(migration.account.eleveId, "eleve-1");
  assert.deepEqual(migration.account.eleveIds, ["eleve-1"]);
  assert.equal(migration.account.elevesAssocies[0].eleveId, "eleve-1");
});

test("resolveParentLegacyLinks refuses ambiguous homonyms", () => {
  const migration = resolveParentLegacyLinks({
    account: {
      role: "parent",
      section: "college",
      elevesAssocies: [{
        eleveNom: "Aminata Bah",
        eleveClasse: "6e A",
        section: "college",
      }],
    },
    studentsByClass: {
      "college|6e a": [
        {
          _id: "eleve-1",
          prenom: "Aminata",
          nom: "Bah",
          classe: "6e A",
          section: "college",
        },
        {
          _id: "eleve-2",
          prenom: "Aminata",
          nom: "Bah",
          classe: "6e A",
          section: "college",
        },
      ],
    },
  });

  assert.equal(migration.didUpdate, false);
  assert.equal(migration.account.eleveId, null);
  assert.equal(migration.account.elevesAssocies[0].eleveId, null);
});

