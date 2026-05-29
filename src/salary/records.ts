// Calcul des montants de fiche + construction des fiches de paie. Extrait de salary-utils.ts (découpage 2026-05-29).

import { SALARY_ALGO_VERSION } from "./types";
import type { Teacher, Person, ScheduleSlot, TeachingEntry, SalaryRecord } from "./types";
import { buildTeacherFullName } from "./names";
import {
  getScheduleSlotHours,
  getTeacherScheduleSlots,
  getTeacherFifthWeekHours,
  getTeacherWeeklyAmount,
  getTeacherFifthWeekAmount,
  getTeacherAbsenceHours,
  getTeacherAbsenceAmount,
  getWeightedPrimeHoraire,
} from "./schedule";

export function getSalaryExecutionHours(salary: SalaryRecord = {}): number {
  return (Number(salary.vhPrevu) || 0) + (Number(salary.cinqSem) || 0) - (Number(salary.nonExecute) || 0);
}

export function getSalaryMontantBrut(salary: SalaryRecord = {}): number {
  if (salary && salary.montantBrut !== undefined && salary.montantBrut !== null && Number.isFinite(Number(salary.montantBrut))) {
    return Number(salary.montantBrut);
  }
  return getSalaryExecutionHours(salary) * (Number(salary.primeHoraire) || 0);
}

export function getSalaryNet(salary: SalaryRecord = {}): number {
  return getSalaryMontantBrut(salary) - (Number(salary.bon) || 0) + (Number(salary.revision) || 0);
}

export function getForfaitNet(salary: SalaryRecord = {}): number {
  return Number(salary.montantForfait || 0) - Number(salary.bon || 0) + Number(salary.revision || 0);
}

export function buildSecondarySalaryObservation(teacher: Teacher = {}, slots: ScheduleSlot[] = []): string {
  const hasRevision = slots.some((slot) => slot.type === "revision");
  const parts = [`Statut: ${teacher.statut || "—"}`];
  if (hasRevision) parts.push("Révisions incluses");
  if ((teacher.primeParClasse || []).some((item) => item.classe && item.prime)) {
    parts.push("Prime pondérée par classe");
  }
  return parts.join(" • ");
}

export type SecondarySalaryOptions = {
  mois?: string;
  emplois?: ScheduleSlot[];
  enseignements?: TeachingEntry[];
  jours5eme?: string[];
  primeDefaut?: number | string;
};

export function buildSecondarySalaryRecord(teacher: Teacher = {}, {
  mois,
  emplois = [],
  enseignements = [],
  jours5eme = [],
  primeDefaut = 0,
}: SecondarySalaryOptions = {}): SalaryRecord | null {
  const nomComplet = buildTeacherFullName(teacher);
  if (!nomComplet) return null;

  const creneaux = getTeacherScheduleSlots(emplois, teacher);
  const vhHebdo = Math.round(creneaux.reduce((sum, slot) => sum + getScheduleSlotHours(slot), 0) * 10) / 10;
  const vhPrevu = Math.round(vhHebdo * 4 * 10) / 10;
  const cinqSem = getTeacherFifthWeekHours(creneaux, jours5eme);
  const nonExecute = getTeacherAbsenceHours(enseignements, teacher, creneaux);
  const montantHebdo = getTeacherWeeklyAmount(teacher, creneaux, primeDefaut);
  const montant5eme = getTeacherFifthWeekAmount(teacher, creneaux, jours5eme, primeDefaut);
  const montantAbsences = getTeacherAbsenceAmount(enseignements, teacher, creneaux, primeDefaut);
  const heuresExecutees = Math.max(0, Math.round(((vhPrevu + cinqSem - nonExecute) || 0) * 10) / 10);
  const montantBrut = Math.max(0, Math.round((montantHebdo * 4) + montant5eme - montantAbsences));
  const primeHoraire = heuresExecutees > 0
    ? Math.round(montantBrut / heuresExecutees)
    : getWeightedPrimeHoraire(teacher, creneaux, primeDefaut);

  return {
    algoVersion: SALARY_ALGO_VERSION,
    section: "Secondaire",
    mois,
    nom: nomComplet,
    matiere: teacher.matiere || "",
    niveau: teacher.grade || "",
    vhHebdo,
    vhPrevu,
    cinqSem,
    nonExecute,
    primeHoraire,
    montantBrut,
    primesVariables: (teacher.primeParClasse || []).some((item) => Boolean(item.classe && item.prime)),
    observation: buildSecondarySalaryObservation(teacher, creneaux),
    paramSnapshot: {
      primeDefaut: Number(primeDefaut) || 0,
      jours5eme: Array.isArray(jours5eme) ? [...jours5eme] : [],
    },
  };
}

export type PrimarySalaryOptions = {
  mois?: string;
  getTeacherMonthlyForfait?: (teacher: Teacher) => number;
};

export function buildPrimarySalaryRecord(teacher: Teacher = {}, { mois, getTeacherMonthlyForfait }: PrimarySalaryOptions = {}): SalaryRecord | null {
  const nomComplet = buildTeacherFullName(teacher);
  if (!nomComplet) return null;

  return {
    algoVersion: SALARY_ALGO_VERSION,
    section: "Primaire",
    mois,
    nom: nomComplet,
    niveau: teacher.grade || teacher.classeTitle || teacher.classe || "",
    matiere: teacher.matiere || "",
    montantForfait: Number(getTeacherMonthlyForfait ? getTeacherMonthlyForfait(teacher) : 0),
    observation: `Statut: ${teacher.statut || "—"}${teacher.classeTitle ? ` · Titulaire ${teacher.classeTitle}` : ""}`,
  };
}

export function buildPersonnelSalaryRecord(person: Person = {}, { mois }: { mois?: string } = {}): SalaryRecord | null {
  const nomComplet = `${person.prenom || ""} ${person.nom || ""}`.trim();
  if (!nomComplet) return null;

  return {
    algoVersion: SALARY_ALGO_VERSION,
    section: "Personnel",
    mois,
    nom: nomComplet,
    poste: person.poste || "",
    categorie: person.categorie || "",
    montantForfait: Number(person.salaireBase || 0),
    observation: person.observation || "",
  };
}
