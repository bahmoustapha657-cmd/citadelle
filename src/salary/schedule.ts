// Calculs liés aux emplois du temps / heures / primes. Extrait de salary-utils.ts (découpage 2026-05-29).

import { TOUS_MOIS_LONGS } from "../constants.js";
import type { Teacher, ScheduleSlot, TeachingEntry } from "./types";
import { normalizeText, matchesTeacherName } from "./names";

export function getScheduleSlotHours(slot: ScheduleSlot = {}): number {
  if (!slot.heureDebut || !slot.heureFin) return 2;

  const [hd, md] = String(slot.heureDebut).split(":").map(Number);
  const [hf, mf] = String(slot.heureFin).split(":").map(Number);
  const duree = ((hf * 60 + mf) - (hd * 60 + md)) / 60;

  return Number.isFinite(duree) && duree > 0 ? Math.round(duree * 10) / 10 : 2;
}

export function getTeacherScheduleSlots(emplois: ScheduleSlot[] = [], teacher: Teacher = {}): ScheduleSlot[] {
  return emplois.filter((slot) => matchesTeacherName(slot.enseignant, teacher));
}

export function getSlotPrimeForTeacher(teacher: Teacher = {}, slot: ScheduleSlot = {}, primeDefaut: number | string = 0): number {
  if (slot.type === "revision" && slot.primeRevision) return Number(slot.primeRevision);

  const primesParClasse = Array.isArray(teacher.primeParClasse) ? teacher.primeParClasse : [];
  const slotClasse = normalizeText(slot.classe);
  const match = primesParClasse.find((item) => normalizeText(item.classe) === slotClasse);
  if (match) return Number(match.prime || 0);

  return Number(teacher.primeHoraire || primeDefaut || 0);
}

export function getTeacherDefaultSlotHours(teacherSlots: ScheduleSlot[] = []): number {
  const frequencies = new Map<number, number>();

  teacherSlots.forEach((slot) => {
    const hours = getScheduleSlotHours(slot);
    frequencies.set(hours, (frequencies.get(hours) || 0) + 1);
  });

  if (frequencies.size === 0) return 2;

  return [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0][0];
}

export function getTeacherFifthWeekHours(teacherSlots: ScheduleSlot[] = [], jours5eme: string[] = []): number {
  if (!jours5eme.length) return 0;

  const jours = new Set(jours5eme.map((jour) => normalizeText(jour)));
  const total = teacherSlots
    .filter((slot) => jours.has(normalizeText(slot.jour)))
    .reduce((sum, slot) => sum + getScheduleSlotHours(slot), 0);

  return Math.round(total * 10) / 10;
}

export function getTeacherWeeklyAmount(teacher: Teacher = {}, teacherSlots: ScheduleSlot[] = [], primeDefaut: number | string = 0): number {
  return teacherSlots.reduce(
    (sum, slot) => sum + getScheduleSlotHours(slot) * getSlotPrimeForTeacher(teacher, slot, primeDefaut),
    0,
  );
}

export function getTeacherFifthWeekAmount(teacher: Teacher = {}, teacherSlots: ScheduleSlot[] = [], jours5eme: string[] = [], primeDefaut: number | string = 0): number {
  if (!jours5eme.length) return 0;

  const jours = new Set(jours5eme.map((jour) => normalizeText(jour)));
  return teacherSlots
    .filter((slot) => jours.has(normalizeText(slot.jour)))
    .reduce(
      (sum, slot) => sum + getScheduleSlotHours(slot) * getSlotPrimeForTeacher(teacher, slot, primeDefaut),
      0,
    );
}

function isAbsenceStatus(value: string = ""): boolean {
  const normalized = normalizeText(value);
  return normalized === "absent" || normalized === "non effectue";
}

export function getTeachingEntryHours(entry: TeachingEntry = {}, teacherSlots: ScheduleSlot[] = []): number {
  const heure = String(entry.heure || "").trim();
  const classe = normalizeText(entry.classe);

  if (heure) {
    const exactSlot = teacherSlots.find((slot) => (
      String(slot.heureDebut || "").trim() === heure
      && normalizeText(slot.classe) === classe
    ));
    if (exactSlot) return getScheduleSlotHours(exactSlot);

    const slotSameTime = teacherSlots.find((slot) => String(slot.heureDebut || "").trim() === heure);
    if (slotSameTime) return getScheduleSlotHours(slotSameTime);
  }

  if (classe) {
    const slotSameClass = teacherSlots.find((slot) => normalizeText(slot.classe) === classe);
    if (slotSameClass) return getScheduleSlotHours(slotSameClass);
  }

  return getTeacherDefaultSlotHours(teacherSlots);
}

function findTeachingEntrySlot(entry: TeachingEntry = {}, teacherSlots: ScheduleSlot[] = []): ScheduleSlot | null {
  const heure = String(entry.heure || "").trim();
  const classe = normalizeText(entry.classe);

  if (heure) {
    const exactSlot = teacherSlots.find((slot) => (
      String(slot.heureDebut || "").trim() === heure
      && normalizeText(slot.classe) === classe
    ));
    if (exactSlot) return exactSlot;

    const slotSameTime = teacherSlots.find((slot) => String(slot.heureDebut || "").trim() === heure);
    if (slotSameTime) return slotSameTime;
  }

  if (classe) {
    const slotSameClass = teacherSlots.find((slot) => normalizeText(slot.classe) === classe);
    if (slotSameClass) return slotSameClass;
  }

  return null;
}

export function getTeacherAbsenceHours(enseignements: TeachingEntry[] = [], teacher: Teacher = {}, teacherSlots: ScheduleSlot[] = []): number {
  const total = enseignements
    .filter((entry) => matchesTeacherName(entry.enseignantNom, teacher) && isAbsenceStatus(entry.statut))
    .reduce((sum, entry) => sum + getTeachingEntryHours(entry, teacherSlots), 0);

  return Math.round(total * 10) / 10;
}

export function getTeacherAbsenceAmount(enseignements: TeachingEntry[] = [], teacher: Teacher = {}, teacherSlots: ScheduleSlot[] = [], primeDefaut: number | string = 0): number {
  return enseignements
    .filter((entry) => matchesTeacherName(entry.enseignantNom, teacher) && isAbsenceStatus(entry.statut))
    .reduce((sum, entry) => {
      const slot = findTeachingEntrySlot(entry, teacherSlots);
      if (slot) {
        return sum + getScheduleSlotHours(slot) * getSlotPrimeForTeacher(teacher, slot, primeDefaut);
      }
      return sum + getTeachingEntryHours(entry, teacherSlots) * Number(teacher.primeHoraire || primeDefaut || 0);
    }, 0);
}

export function getWeightedPrimeHoraire(teacher: Teacher = {}, teacherSlots: ScheduleSlot[] = [], primeDefaut: number | string = 0): number {
  const vhHebdo = Math.round(teacherSlots.reduce((sum, slot) => sum + getScheduleSlotHours(slot), 0) * 10) / 10;
  if (vhHebdo <= 0) return Number(teacher.primeHoraire || primeDefaut || 0);

  const totalSalaireHebdo = getTeacherWeeklyAmount(teacher, teacherSlots, primeDefaut);

  return Math.round(totalSalaireHebdo / vhHebdo);
}

export function getFifthWeekDays(moisNom: string, nowDate: Date = new Date()): string[] {
  const idxMois = (TOUS_MOIS_LONGS as string[]).indexOf(moisNom);
  if (idxMois < 0) return [];

  const jsM = nowDate.getMonth();
  const idxActuel = jsM >= 8 ? jsM - 8 : jsM + 4;
  const anneeDebutScolaire = idxActuel < 4 ? nowDate.getFullYear() : nowDate.getFullYear() - 1;
  const anneeReel = idxMois < 4 ? anneeDebutScolaire : anneeDebutScolaire + 1;
  const jsMoisCible = idxMois < 4 ? idxMois + 8 : idxMois - 4;
  const joursFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const nbJours = new Date(anneeReel, jsMoisCible + 1, 0).getDate();
  const compteur: Record<string, number> = {};

  for (let jour = 1; jour <= nbJours; jour += 1) {
    const nom = joursFr[new Date(anneeReel, jsMoisCible, jour).getDay()];
    compteur[nom] = (compteur[nom] || 0) + 1;
  }

  return Object.entries(compteur)
    .filter(([nom, count]) => count === 5 && nom !== "Dimanche")
    .map(([nom]) => nom);
}
