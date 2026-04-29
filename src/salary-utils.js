function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function stripLegacyTeacherSuffix(value = "") {
  return String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export function buildTeacherFullName(teacher = {}) {
  return `${teacher.prenom || ""} ${teacher.nom || ""}`.trim();
}

export function matchesTeacherName(value = "", teacher = {}) {
  const target = normalizeText(stripLegacyTeacherSuffix(value));
  if (!target) return false;

  const aliases = [
    buildTeacherFullName(teacher),
    teacher.nomComplet,
    teacher.enseignantNom,
  ]
    .map((alias) => normalizeText(stripLegacyTeacherSuffix(alias)))
    .filter(Boolean);

  return aliases.includes(target);
}

export function getScheduleSlotHours(slot = {}) {
  if (!slot.heureDebut || !slot.heureFin) return 2;

  const [hd, md] = String(slot.heureDebut).split(":").map(Number);
  const [hf, mf] = String(slot.heureFin).split(":").map(Number);
  const duree = ((hf * 60 + mf) - (hd * 60 + md)) / 60;

  return Number.isFinite(duree) && duree > 0 ? Math.round(duree * 10) / 10 : 2;
}

export function getTeacherScheduleSlots(emplois = [], teacher = {}) {
  return emplois.filter((slot) => matchesTeacherName(slot.enseignant, teacher));
}

export function getSlotPrimeForTeacher(teacher = {}, slot = {}, primeDefaut = 0) {
  if (slot.type === "revision" && slot.primeRevision) return Number(slot.primeRevision);

  const primesParClasse = Array.isArray(teacher.primeParClasse) ? teacher.primeParClasse : [];
  const slotClasse = normalizeText(slot.classe);
  const match = primesParClasse.find((item) => normalizeText(item.classe) === slotClasse);
  if (match) return Number(match.prime || 0);

  return Number(teacher.primeHoraire || primeDefaut || 0);
}

export function getTeacherDefaultSlotHours(teacherSlots = []) {
  const frequencies = new Map();

  teacherSlots.forEach((slot) => {
    const hours = getScheduleSlotHours(slot);
    frequencies.set(hours, (frequencies.get(hours) || 0) + 1);
  });

  if (frequencies.size === 0) return 2;

  return [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || right[0] - left[0])[0][0];
}

export function getTeacherFifthWeekHours(teacherSlots = [], jours5eme = []) {
  if (!jours5eme.length) return 0;

  const jours = new Set(jours5eme.map((jour) => normalizeText(jour)));
  const total = teacherSlots
    .filter((slot) => jours.has(normalizeText(slot.jour)))
    .reduce((sum, slot) => sum + getScheduleSlotHours(slot), 0);

  return Math.round(total * 10) / 10;
}

export function getTeacherWeeklyAmount(teacher = {}, teacherSlots = [], primeDefaut = 0) {
  return teacherSlots.reduce(
    (sum, slot) => sum + getScheduleSlotHours(slot) * getSlotPrimeForTeacher(teacher, slot, primeDefaut),
    0,
  );
}

export function getTeacherFifthWeekAmount(teacher = {}, teacherSlots = [], jours5eme = [], primeDefaut = 0) {
  if (!jours5eme.length) return 0;

  const jours = new Set(jours5eme.map((jour) => normalizeText(jour)));
  return teacherSlots
    .filter((slot) => jours.has(normalizeText(slot.jour)))
    .reduce(
      (sum, slot) => sum + getScheduleSlotHours(slot) * getSlotPrimeForTeacher(teacher, slot, primeDefaut),
      0,
    );
}

function isAbsenceStatus(value = "") {
  const normalized = normalizeText(value);
  return normalized === "absent" || normalized === "non effectue";
}

export function getTeachingEntryHours(entry = {}, teacherSlots = []) {
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

function findTeachingEntrySlot(entry = {}, teacherSlots = []) {
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

export function getTeacherAbsenceHours(enseignements = [], teacher = {}, teacherSlots = []) {
  const total = enseignements
    .filter((entry) => matchesTeacherName(entry.enseignantNom, teacher) && isAbsenceStatus(entry.statut))
    .reduce((sum, entry) => sum + getTeachingEntryHours(entry, teacherSlots), 0);

  return Math.round(total * 10) / 10;
}

export function getTeacherAbsenceAmount(enseignements = [], teacher = {}, teacherSlots = [], primeDefaut = 0) {
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

export function getWeightedPrimeHoraire(teacher = {}, teacherSlots = [], primeDefaut = 0) {
  const vhHebdo = Math.round(teacherSlots.reduce((sum, slot) => sum + getScheduleSlotHours(slot), 0) * 10) / 10;
  if (vhHebdo <= 0) return Number(teacher.primeHoraire || primeDefaut || 0);

  const totalSalaireHebdo = getTeacherWeeklyAmount(teacher, teacherSlots, primeDefaut);

  return Math.round(totalSalaireHebdo / vhHebdo);
}
