import assert from "node:assert/strict";
import test from "node:test";
import { matchesStudentLink, matchesTeacherAlias, normalizeSection } from "../api/_lib/portal-data.js";

test("normalizeSection maps secondaire to college", () => {
  assert.equal(normalizeSection("secondaire"), "college");
  assert.equal(normalizeSection("lycee"), "lycee");
});

test("matchesTeacherAlias ignores case and accents", () => {
  assert.equal(matchesTeacherAlias("Moussa Diallo", ["moussa diallo"]), true);
  assert.equal(matchesTeacherAlias("Moussa Diallo", ["Moussa Diállo"]), true);
  assert.equal(matchesTeacherAlias("Mamadou Barry", ["moussa diallo"]), false);
});

test("matchesStudentLink supports direct ids and legacy full-name links", () => {
  const student = {
    _id: "eleve-1",
    prenom: "Aminata",
    nom: "Bah",
    classe: "6e A",
    section: "college",
  };

  assert.equal(matchesStudentLink(student, { eleveId: "eleve-1" }, "college"), true);
  assert.equal(matchesStudentLink(student, {
    eleveNom: "Aminata Bah",
    eleveClasse: "6e A",
    section: "college",
  }, "college"), true);
  assert.equal(matchesStudentLink(student, {
    eleveNom: "Aminata Bah",
    eleveClasse: "5e A",
    section: "college",
  }, "college"), false);
});
