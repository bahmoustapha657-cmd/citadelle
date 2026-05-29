// ══════════════════════════════════════════════════════════════
//  Salary utils — point d'entrée (barrel)
// ══════════════════════════════════════════════════════════════
// Le fichier monolithique de 637 LOC a été éclaté en modules
// thématiques sous `src/salary/` (refactor 2026-05-29). Ce barrel
// conserve les imports historiques (`import { X } from "./salary-utils"`)
// inchangés. Les helpers internes normalizeText / stripLegacyTeacherSuffix
// restent privés au domaine (non re-exportés ici).

export { SALARY_ALGO_VERSION } from "./salary/types";
export type {
  PrimeParClasse,
  Teacher,
  ScheduleSlot,
  TeachingEntry,
  Person,
  ParamSnapshot,
  SalaryRecord,
  SalaryTotals,
} from "./salary/types";

export {
  buildTeacherFullName,
  matchesTeacherName,
  normalizeSalaryName,
} from "./salary/names";

export {
  getScheduleSlotHours,
  getTeacherScheduleSlots,
  getSlotPrimeForTeacher,
  getTeacherDefaultSlotHours,
  getTeacherFifthWeekHours,
  getTeacherWeeklyAmount,
  getTeacherFifthWeekAmount,
  getTeachingEntryHours,
  getTeacherAbsenceHours,
  getTeacherAbsenceAmount,
  getWeightedPrimeHoraire,
  getFifthWeekDays,
} from "./salary/schedule";

export {
  getSalaryExecutionHours,
  getSalaryMontantBrut,
  getSalaryNet,
  getForfaitNet,
  buildSecondarySalaryObservation,
  buildSecondarySalaryRecord,
  buildPrimarySalaryRecord,
  buildPersonnelSalaryRecord,
} from "./salary/records";
export type {
  SecondarySalaryOptions,
  PrimarySalaryOptions,
} from "./salary/records";

export {
  getMissingSalaryProfiles,
  mergeSalaryWithManualFields,
  findSalaryDuplicate,
  findBonsForSalary,
  sumBonsForSalary,
  findExistingSalaryDuplicates,
  pickBestSalaryFromGroup,
  groupSalariesByPersonMonth,
  summarizeSalaryTotals,
} from "./salary/aggregation";
export type {
  MissingSalaryProfilesOptions,
  MissingSalaryProfiles,
  BonRecord,
  SalaryPersonMonth,
} from "./salary/aggregation";
