import assert from "node:assert/strict";
import test from "node:test";
import { buildSessionAccountPayload, buildUserProfilePayload } from "../api/_lib/user-profiles.js";

test("buildUserProfilePayload preserves parent account links and household fields", () => {
  const payload = buildUserProfilePayload({
    account: {
      role: "parent",
      login: "parent.bah",
      nom: "Maman Bah",
      eleveId: "eleve-1",
      eleveNom: "Aminata Bah",
      eleveClasse: "6e A",
      section: "college",
      eleveIds: ["eleve-1"],
      elevesAssocies: [{
        eleveId: "eleve-1",
        eleveNom: "Aminata Bah",
        eleveClasse: "6e A",
        section: "college",
      }],
      tuteur: "Maman Bah",
      contactTuteur: "622000000",
      filiation: "Mere",
    },
    schoolId: "ecole-bah",
    login: "parent.bah",
    email: "parent.bah.ecole-bah@edugest.app",
    compteDocId: "compte-1",
  });

  assert.equal(payload.role, "parent");
  assert.equal(payload.schoolId, "ecole-bah");
  assert.equal(payload.eleveId, "eleve-1");
  assert.deepEqual(payload.eleveIds, ["eleve-1"]);
  assert.equal(payload.elevesAssocies.length, 1);
  assert.equal(payload.tuteur, "Maman Bah");
  assert.equal(payload.contactTuteur, "622000000");
  assert.equal(payload.filiation, "Mere");
});

test("buildSessionAccountPayload keeps teacher scope for frontend hydration", () => {
  const payload = buildSessionAccountPayload({
    role: "enseignant",
    login: "moussa.diallo",
    nom: "Moussa Diallo",
    enseignantId: "ens-1",
    enseignantNom: "Moussa Diallo",
    section: "college",
    sections: ["college"],
    matiere: "Maths",
  }, "moussa.diallo");

  assert.equal(payload.role, "enseignant");
  assert.equal(payload.enseignantId, "ens-1");
  assert.equal(payload.enseignantNom, "Moussa Diallo");
  assert.equal(payload.section, "college");
  assert.deepEqual(payload.sections, ["college"]);
  assert.equal(payload.matiere, "Maths");
});
