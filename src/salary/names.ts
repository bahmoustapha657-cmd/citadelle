// Normalisation et matching des noms d'agents. Extrait de salary-utils.ts (découpage 2026-05-29).

import type { Teacher } from "./types";

// Helpers internes au domaine paie (non exposés par le barrel salary-utils).
export function normalizeText(value: string = ""): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export function stripLegacyTeacherSuffix(value: string = ""): string {
  return String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function buildTeacherFullName(teacher: Teacher = {}): string {
  return `${teacher.prenom || ""} ${teacher.nom || ""}`.trim();
}

export function matchesTeacherName(value: string = "", teacher: Teacher = {}): boolean {
  const target = normalizeText(stripLegacyTeacherSuffix(value));
  if (!target) return false;

  const aliases = [
    buildTeacherFullName(teacher),
    teacher.nomComplet,
    teacher.enseignantNom,
  ]
    .map((alias) => normalizeText(stripLegacyTeacherSuffix(alias || "")))
    .filter(Boolean);

  return aliases.includes(target);
}

// Normalise un nom pour les comparaisons côté paie (accents, casse,
// whitespace, suffixe legacy "(prof)" / "(titulaire)"). Exposé pour
// que les callers UI (filtre bons, regroupement, exports) partagent
// la même règle que findSalaryDuplicate.
export function normalizeSalaryName(name: string = ""): string {
  return normalizeText(stripLegacyTeacherSuffix(String(name || "")));
}
