import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPersonnelSalaryRecord,
  buildPrimarySalaryRecord,
  buildSecondarySalaryRecord,
  buildTeacherFullName,
  getFifthWeekDays,
  getForfaitNet,
  getMissingSalaryProfiles,
  getTeacherAbsenceAmount,
  getScheduleSlotHours,
  getTeacherAbsenceHours,
  getTeacherDefaultSlotHours,
  getTeacherFifthWeekAmount,
  getTeacherFifthWeekHours,
  getTeacherScheduleSlots,
  getSalaryExecutionHours,
  getSalaryMontantBrut,
  getSalaryNet,
  getTeacherWeeklyAmount,
  getWeightedPrimeHoraire,
  mergeSalaryWithManualFields,
  matchesTeacherName,
  summarizeSalaryTotals,
} from "../src/salary-utils.js";

test("matchesTeacherName uses the full teacher identity and ignores legacy suffixes", () => {
  const teacher = { prenom: "Aminata", nom: "Diallo" };

  assert.equal(matchesTeacherName("Aminata Diallo", teacher), true);
  assert.equal(matchesTeacherName("Aminata Diallo (Maths)", teacher), true);
  assert.equal(matchesTeacherName("Diallo", teacher), false);
  assert.equal(matchesTeacherName("Mamadou Diallo", teacher), false);
});

test("getTeacherScheduleSlots only keeps slots for the exact teacher", () => {
  const teacher = { prenom: "Aminata", nom: "Diallo" };
  const emplois = [
    { enseignant: "Aminata Diallo", heureDebut: "08:00", heureFin: "10:00" },
    { enseignant: "Mamadou Diallo", heureDebut: "10:00", heureFin: "12:00" },
    { enseignant: "Aminata Diallo (Maths)", heureDebut: "13:00", heureFin: "15:00" },
  ];

  const slots = getTeacherScheduleSlots(emplois, teacher);
  assert.equal(slots.length, 2);
});

test("salary helpers compute hours from the timetable durations", () => {
  const teacher = {
    prenom: "Aminata",
    nom: "Diallo",
    primeHoraire: 20000,
    primeParClasse: [{ classe: "10A", prime: 25000 }],
  };
  const teacherSlots = [
    { enseignant: "Aminata Diallo", jour: "Lundi", classe: "10A", heureDebut: "08:00", heureFin: "10:00" },
    { enseignant: "Aminata Diallo", jour: "Mercredi", classe: "11A", heureDebut: "10:00", heureFin: "11:00" },
    { enseignant: "Aminata Diallo", jour: "Vendredi", classe: "10A", heureDebut: "08:00", heureFin: "10:00", type: "revision", primeRevision: 30000 },
  ];

  assert.equal(buildTeacherFullName(teacher), "Aminata Diallo");
  assert.equal(getScheduleSlotHours(teacherSlots[0]), 2);
  assert.equal(getTeacherDefaultSlotHours(teacherSlots), 2);
  assert.equal(getTeacherFifthWeekHours(teacherSlots, ["Lundi", "Vendredi"]), 4);
  assert.equal(getWeightedPrimeHoraire(teacher, teacherSlots, 15000), 26000);
});

test("getTeacherAbsenceHours subtracts timetable hours instead of raw session count", () => {
  const teacher = { prenom: "Aminata", nom: "Diallo" };
  const teacherSlots = [
    { enseignant: "Aminata Diallo", classe: "10A", heureDebut: "08:00", heureFin: "10:00" },
    { enseignant: "Aminata Diallo", classe: "11A", heureDebut: "10:00", heureFin: "11:00" },
  ];
  const enseignements = [
    { enseignantNom: "Aminata Diallo", classe: "10A", heure: "08:00", statut: "Absent" },
    { enseignantNom: "Aminata Diallo", classe: "11A", heure: "10:00", statut: "Non effectué" },
    { enseignantNom: "Mamadou Diallo", classe: "10A", heure: "08:00", statut: "Absent" },
  ];

  assert.equal(getTeacherAbsenceHours(enseignements, teacher, teacherSlots), 3);
});

test("salary helpers keep exact class-based amounts for fifth week and absences", () => {
  const teacher = {
    prenom: "Aminata",
    nom: "Diallo",
    primeHoraire: 20000,
    primeParClasse: [{ classe: "10A", prime: 30000 }],
  };
  const teacherSlots = [
    { enseignant: "Aminata Diallo", jour: "Lundi", classe: "10A", heureDebut: "08:00", heureFin: "10:00" },
    { enseignant: "Aminata Diallo", jour: "Mardi", classe: "11A", heureDebut: "10:00", heureFin: "12:00" },
  ];
  const enseignements = [
    { enseignantNom: "Aminata Diallo", classe: "10A", heure: "08:00", statut: "Absent" },
  ];

  assert.equal(getTeacherWeeklyAmount(teacher, teacherSlots, 15000), 100000);
  assert.equal(getTeacherFifthWeekAmount(teacher, teacherSlots, ["Lundi"], 15000), 60000);
  assert.equal(getTeacherAbsenceAmount(enseignements, teacher, teacherSlots, 15000), 60000);
});

test("salary record builders keep business rules outside the UI", () => {
  const secondary = buildSecondarySalaryRecord({
    prenom: "Aminata",
    nom: "Diallo",
    matiere: "Maths",
    grade: "Titulaire",
    statut: "Actif",
    primeHoraire: 20000,
    primeParClasse: [{ classe: "10A", prime: 30000 }],
  }, {
    mois: "Octobre",
    emplois: [
      { enseignant: "Aminata Diallo", jour: "Lundi", classe: "10A", heureDebut: "08:00", heureFin: "10:00" },
      { enseignant: "Aminata Diallo", jour: "Vendredi", classe: "10A", heureDebut: "08:00", heureFin: "10:00", type: "revision", primeRevision: 35000 },
    ],
    enseignements: [
      { enseignantNom: "Aminata Diallo", classe: "10A", heure: "08:00", statut: "Absent" },
    ],
    jours5eme: ["Vendredi"],
    primeDefaut: 15000,
  });

  assert.equal(secondary.section, "Secondaire");
  assert.equal(secondary.nom, "Aminata Diallo");
  assert.equal(secondary.cinqSem, 2);
  assert.equal(secondary.nonExecute, 2);
  assert.equal(secondary.primesVariables, true);
  assert.match(secondary.observation, /Prime pondérée par classe/);

  const primary = buildPrimarySalaryRecord({
    prenom: "Mariam",
    nom: "Barry",
    classeTitle: "CM1",
    statut: "Titulaire",
  }, {
    mois: "Octobre",
    getTeacherMonthlyForfait: () => 850000,
  });

  assert.equal(primary.section, "Primaire");
  assert.equal(primary.montantForfait, 850000);
  assert.match(primary.observation, /Titulaire CM1/);

  const personnel = buildPersonnelSalaryRecord({
    prenom: "Moussa",
    nom: "Camara",
    poste: "Comptable",
    categorie: "Administration",
    salaireBase: 1200000,
  }, { mois: "Octobre" });

  assert.equal(personnel.section, "Personnel");
  assert.equal(personnel.montantForfait, 1200000);
});

test("salary summary helpers compute gross, bon and net totals", () => {
  const secondarySalary = {
    section: "Secondaire",
    vhPrevu: 8,
    cinqSem: 2,
    nonExecute: 1,
    primeHoraire: 20000,
    bon: 50000,
    revision: 10000,
  };
  const primarySalary = {
    section: "Primaire",
    montantForfait: 900000,
    bon: 100000,
    revision: 50000,
  };

  assert.equal(getSalaryExecutionHours(secondarySalary), 9);
  assert.equal(getSalaryMontantBrut(secondarySalary), 180000);
  assert.equal(getSalaryNet(secondarySalary), 140000);
  assert.equal(getForfaitNet(primarySalary), 850000);

  const totals = summarizeSalaryTotals([secondarySalary, primarySalary]);
  assert.deepEqual(totals, {
    montant: 1080000,
    bon: 150000,
    revision: 60000,
    net: 990000,
  });
});

test("getMissingSalaryProfiles flags incomplete payroll records", () => {
  const missing = getMissingSalaryProfiles({
    ensCollege: [{ prenom: "A", nom: "B", primeHoraire: 0, primeParClasse: [] }],
    ensLycee: [],
    ensPrimaire: [{ prenom: "C", nom: "D", montantForfait: 0 }],
    personnel: [{ prenom: "E", nom: "F", statut: "Actif", salaireBase: 0 }],
    primeDefaut: 0,
  });

  assert.equal(missing.secMissing.length, 1);
  assert.equal(missing.primMissing.length, 1);
  assert.equal(missing.persMissing.length, 1);
});

test("mergeSalaryWithManualFields preserves bon and revision entered by hand", () => {
  const merged = mergeSalaryWithManualFields(
    { bon: 75000, revision: 10000, autre: "ignore" },
    { section: "Secondaire", nom: "Aminata Diallo", montantBrut: 240000 },
  );

  assert.equal(merged.bon, 75000);
  assert.equal(merged.revision, 10000);
  assert.equal(merged.montantBrut, 240000);
});

test("getFifthWeekDays detects fifth weekdays inside the school year calendar", () => {
  const days = getFifthWeekDays("Mars", new Date("2026-03-15T12:00:00Z"));
  assert.ok(Array.isArray(days));
  assert.ok(days.length > 0);
  assert.equal(days.includes("Dimanche"), false);
});
