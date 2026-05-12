import { TOUS_MOIS_LONGS } from "./constants.js";

// Bumper à chaque changement de formule de salaire (heures, prime, montantBrut)
// qui rendrait les fiches précédentes non reproductibles.
export const SALARY_ALGO_VERSION = 1;

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

export function getFifthWeekDays(moisNom, nowDate = new Date()) {
  const idxMois = TOUS_MOIS_LONGS.indexOf(moisNom);
  if (idxMois < 0) return [];

  const jsM = nowDate.getMonth();
  const idxActuel = jsM >= 8 ? jsM - 8 : jsM + 4;
  const anneeDebutScolaire = idxActuel < 4 ? nowDate.getFullYear() : nowDate.getFullYear() - 1;
  const anneeReel = idxMois < 4 ? anneeDebutScolaire : anneeDebutScolaire + 1;
  const jsMoisCible = idxMois < 4 ? idxMois + 8 : idxMois - 4;
  const joursFr = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const nbJours = new Date(anneeReel, jsMoisCible + 1, 0).getDate();
  const compteur = {};

  for (let jour = 1; jour <= nbJours; jour += 1) {
    const nom = joursFr[new Date(anneeReel, jsMoisCible, jour).getDay()];
    compteur[nom] = (compteur[nom] || 0) + 1;
  }

  return Object.entries(compteur)
    .filter(([nom, count]) => count === 5 && nom !== "Dimanche")
    .map(([nom]) => nom);
}

export function getSalaryExecutionHours(salary = {}) {
  return (Number(salary.vhPrevu) || 0) + (Number(salary.cinqSem) || 0) - (Number(salary.nonExecute) || 0);
}

export function getSalaryMontantBrut(salary = {}) {
  if (salary && salary.montantBrut !== undefined && salary.montantBrut !== null && Number.isFinite(Number(salary.montantBrut))) {
    return Number(salary.montantBrut);
  }
  return getSalaryExecutionHours(salary) * (Number(salary.primeHoraire) || 0);
}

export function getSalaryNet(salary = {}) {
  return getSalaryMontantBrut(salary) - (Number(salary.bon) || 0) + (Number(salary.revision) || 0);
}

export function getForfaitNet(salary = {}) {
  return Number(salary.montantForfait || 0) - Number(salary.bon || 0) + Number(salary.revision || 0);
}

export function buildSecondarySalaryObservation(teacher = {}, slots = []) {
  const hasRevision = slots.some((slot) => slot.type === "revision");
  const parts = [`Statut: ${teacher.statut || "—"}`];
  if (hasRevision) parts.push("Révisions incluses");
  if ((teacher.primeParClasse || []).some((item) => item.classe && item.prime)) {
    parts.push("Prime pondérée par classe");
  }
  return parts.join(" • ");
}

export function buildSecondarySalaryRecord(teacher = {}, {
  mois,
  emplois = [],
  enseignements = [],
  jours5eme = [],
  primeDefaut = 0,
} = {}) {
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
    primesVariables: (teacher.primeParClasse || []).some((item) => item.classe && item.prime),
    observation: buildSecondarySalaryObservation(teacher, creneaux),
    paramSnapshot: {
      primeDefaut: Number(primeDefaut) || 0,
      jours5eme: Array.isArray(jours5eme) ? [...jours5eme] : [],
    },
  };
}

export function buildPrimarySalaryRecord(teacher = {}, { mois, getTeacherMonthlyForfait } = {}) {
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

export function buildPersonnelSalaryRecord(person = {}, { mois } = {}) {
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

export function getMissingSalaryProfiles({
  ensCollege = [],
  ensLycee = [],
  ensPrimaire = [],
  personnel = [],
  primeDefaut = 0,
} = {}) {
  const defaultPrimeSet = (Number(primeDefaut) || 0) > 0;
  const secMissing = defaultPrimeSet ? [] : [...ensCollege, ...ensLycee].filter((teacher) => {
    const hasPrime = Number(teacher.primeHoraire || 0) > 0;
    const hasPPC = (teacher.primeParClasse || []).some((item) => item.classe && Number(item.prime) > 0);
    return !hasPrime && !hasPPC;
  });
  const primMissing = ensPrimaire.filter((teacher) => Number(teacher.montantForfait || teacher.salaireBase || teacher.forfait || 0) <= 0);
  const persMissing = personnel.filter((person) => (person.statut || "Actif") === "Actif" && Number(person.salaireBase || 0) <= 0);

  return { secMissing, primMissing, persMissing };
}

export function mergeSalaryWithManualFields(existingSalary = {}, computedSalary = {}) {
  return {
    ...existingSalary,
    ...computedSalary,
    bon: Number(existingSalary.bon || 0),
    revision: Number(existingSalary.revision || 0),
  };
}

export function summarizeSalaryTotals(salaries = []) {
  return salaries.reduce((summary, salary) => {
    const isForfait = salary.section === "Primaire" || salary.section === "Personnel";
    const montant = isForfait ? Number(salary.montantForfait || 0) : getSalaryMontantBrut(salary);
    const bon = Number(salary.bon || 0);
    const revision = Number(salary.revision || 0);
    const net = isForfait ? getForfaitNet(salary) : getSalaryNet(salary);

    return {
      montant: summary.montant + montant,
      bon: summary.bon + bon,
      revision: summary.revision + revision,
      net: summary.net + net,
    };
  }, { montant: 0, bon: 0, revision: 0, net: 0 });
}
