import assert from "node:assert/strict";
import test from "node:test";
import {
  getSchoolPeriodicite,
  getPeriodesForSchool,
  getDefaultPeriode,
  getPeriodeLongLabel,
  isPeriodeValid,
  PERIODICITES,
} from "../src/period-utils.ts";

test("getSchoolPeriodicite returns 'trimestre' by default (legacy schools without field)", () => {
  assert.equal(getSchoolPeriodicite({}), "trimestre");
  assert.equal(getSchoolPeriodicite(), "trimestre");
});

test("getSchoolPeriodicite accepts only valid values, falls back to trimestre", () => {
  assert.equal(getSchoolPeriodicite({ periodicite: "semestre" }), "semestre");
  assert.equal(getSchoolPeriodicite({ periodicite: "mensuel" }), "mensuel");
  assert.equal(getSchoolPeriodicite({ periodicite: "trimestre" }), "trimestre");
  assert.equal(getSchoolPeriodicite({ periodicite: "bidon" }), "trimestre");
  assert.equal(getSchoolPeriodicite({ periodicite: null }), "trimestre");
});

test("getPeriodesForSchool returns T1/T2/T3 for trimestre", () => {
  assert.deepEqual(getPeriodesForSchool({ periodicite: "trimestre" }), ["T1", "T2", "T3"]);
  assert.deepEqual(getPeriodesForSchool({}), ["T1", "T2", "T3"]);
});

test("getPeriodesForSchool returns S1/S2 for semestre", () => {
  assert.deepEqual(getPeriodesForSchool({ periodicite: "semestre" }), ["S1", "S2"]);
});

test("getPeriodesForSchool uses provided moisAnnee for mensuel", () => {
  const mois = ["Oct", "Nov", "Déc"];
  assert.deepEqual(getPeriodesForSchool({ periodicite: "mensuel" }, mois), mois);
});

test("getPeriodesForSchool falls back to calcMoisAnnee when moisAnnee absent", () => {
  const result = getPeriodesForSchool({ periodicite: "mensuel", moisDebut: "Octobre" });
  assert.equal(result.length, 9);
  assert.equal(result[0], "Oct");
});

test("getDefaultPeriode returns the first period", () => {
  assert.equal(getDefaultPeriode({ periodicite: "trimestre" }), "T1");
  assert.equal(getDefaultPeriode({ periodicite: "semestre" }), "S1");
  assert.equal(getDefaultPeriode({ periodicite: "mensuel" }, ["Oct", "Nov"]), "Oct");
});

test("getPeriodeLongLabel translates known codes", () => {
  assert.equal(getPeriodeLongLabel("T1"), "1er trimestre");
  assert.equal(getPeriodeLongLabel("T3"), "3ème trimestre");
  assert.equal(getPeriodeLongLabel("S1"), "1er semestre");
  assert.equal(getPeriodeLongLabel("S2"), "2ème semestre");
});

test("getPeriodeLongLabel returns the input unchanged for months", () => {
  assert.equal(getPeriodeLongLabel("Oct"), "Oct");
  assert.equal(getPeriodeLongLabel("Janvier"), "Janvier");
});

test("isPeriodeValid checks membership in the school's period list", () => {
  assert.equal(isPeriodeValid("T1", { periodicite: "trimestre" }), true);
  assert.equal(isPeriodeValid("T3", { periodicite: "trimestre" }), true);
  assert.equal(isPeriodeValid("S1", { periodicite: "trimestre" }), false);
  assert.equal(isPeriodeValid("T3", { periodicite: "semestre" }), false);
  assert.equal(isPeriodeValid("", { periodicite: "trimestre" }), false);
});

test("PERIODICITES exposes all three options with labels", () => {
  assert.equal(PERIODICITES.length, 3);
  const values = PERIODICITES.map((p) => p.value);
  assert.deepEqual(values.sort(), ["mensuel", "semestre", "trimestre"]);
});
