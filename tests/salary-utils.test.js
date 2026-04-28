import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTeacherFullName,
  getScheduleSlotHours,
  getTeacherAbsenceHours,
  getTeacherDefaultSlotHours,
  getTeacherFifthWeekHours,
  getTeacherScheduleSlots,
  getWeightedPrimeHoraire,
  matchesTeacherName,
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
