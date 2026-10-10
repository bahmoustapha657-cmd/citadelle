// Présences du personnel — enseignants du SECONDAIRE (payés à l'heure).
//
// Les heures « Absent » saisies dans Enseignements (cours par cours) restent
// la base : la fiche de paie les retire du brut (colonne « Non exé. »). Le
// registre des présences y ajoute deux règles décidées avec l'école :
//  - une absence déclarée JUSTIFIÉE dans le registre est payée : les heures
//    « Absent » de ce jour-là ne sont plus retirées ;
//  - une absence INJUSTIFIÉE du registre sans heures « Absent » ce jour-là
//    (journée entière ou demi-journée) et les retards injustifiés (N retards
//    = ½ journée) donnent une retenue, colonne « Abs. ».
// Module pur (testable sous Node).
import {
  buildSecondarySalaryRecord, buildTeacherFullName, getFifthWeekDays, getScheduleSlotHours, getSlotPrimeForTeacher,
  getTeacherScheduleSlots, getTeacherWeeklyAmount, mergeSalaryWithManualFields, normalizeSalaryName,
} from "../../../salary-utils";
import {
  REGLAGES_DEFAUT, anneeCivileDuMois, decompteAgent, moisDeDate, presencesDeLAgent,
} from "./presences-utils";

const NOMS_JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const sansAccent = (v) => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Mêmes statuts que la paie (salary/schedule.ts → isAbsenceStatus).
const estAbsent = (statut) => ["absent", "non effectue"].includes(sansAccent(statut));
const memeNom = (a, b) => normalizeSalaryName(a || "") === normalizeSalaryName(b || "");
const fmtJours = (j) => String(j).replace(".", ",");
const dateCourte = (date) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(date || ""));
  return m ? `${m[2]}/${m[1]}` : "";
};

// Entrée d'Enseignements datée dans `mois` de l'année scolaire.
export function estDuMois(entree, mois, anneeScolaire) {
  if (moisDeDate(entree?.date) !== mois) return false;
  const annee = anneeCivileDuMois(mois, anneeScolaire);
  return !annee || Number(String(entree.date).slice(0, 4)) === annee;
}

// Absence du registre déclarée justifiée pour cet enseignant ce jour-là.
const jourJustifie = (presences, nom, date) => presences.some((p) => p.section === "Secondaire"
  && p.type === "absence" && p.statut === "justifiee" && p.date === date && memeNom(p.agentNom, nom));

// Entrées d'Enseignements qui comptent pour la paie d'un mois : celles du
// mois (auparavant TOUTES les absences de l'année étaient retirées de
// chaque mois), moins les heures d'un jour d'absence justifiée.
export function enseignementsPourPaie(enseignements = [], { mois, anneeScolaire, presences = [] }) {
  return enseignements.filter((e) => estDuMois(e, mois, anneeScolaire)
    && !(estAbsent(e.statut) && jourJustifie(presences, e.enseignantNom, e.date)));
}

// Retenue « Abs. » d'une fiche du secondaire. `creneaux` : créneaux de
// l'enseignant dans l'emploi du temps ; `enseignementsMois` : ses entrées
// d'Enseignements du mois (pour ne pas retenir deux fois un même jour).
export function calculerRetenueSecondaire({
  salaire = {}, teacher = {}, creneaux = [], enseignementsMois = [], presences = [],
  reglages = REGLAGES_DEFAUT, primeDefaut = 0,
}) {
  const faits = presencesDeLAgent(presences, { nom: salaire.nom, section: "Secondaire", mois: salaire.mois });
  const d = decompteAgent(faits, reglages);
  let montant = 0;
  let heures = 0;
  const dates = [];
  for (const p of faits) {
    if (p.type !== "absence" || p.statut !== "injustifiee") continue;
    // Jour déjà saisi cours par cours dans Enseignements : déjà retiré du brut.
    if (enseignementsMois.some((e) => e.date === p.date && estAbsent(e.statut) && memeNom(e.enseignantNom, salaire.nom))) continue;
    const jour = NOMS_JOURS[new Date(`${p.date}T12:00:00`).getDay()];
    const part = p.duree === "demi" ? 0.5 : 1;
    const duJour = creneaux.filter((s) => sansAccent(s.jour) === sansAccent(jour));
    heures += duJour.reduce((s, c) => s + getScheduleSlotHours(c), 0) * part;
    montant += duJour.reduce((s, c) => s + getScheduleSlotHours(c) * getSlotPrimeForTeacher(teacher, c, primeDefaut), 0) * part;
    dates.push(dateCourte(p.date) + (part < 1 ? " (½)" : ""));
  }
  // Retards : ½ journée = moitié d'une journée de cours moyenne.
  const joursDeCours = new Set(creneaux.map((c) => sansAccent(c.jour)).filter(Boolean)).size;
  const montantJour = joursDeCours ? getTeacherWeeklyAmount(teacher, creneaux, primeDefaut) / joursDeCours : 0;
  const montantRetards = d.joursRetards * montantJour;
  montant = Math.round(montant + montantRetards);
  const parties = [];
  if (dates.length) parties.push(`abs. ${dates.sort().join(", ")} (${fmtJours(Math.round(heures * 10) / 10)} h)`);
  if (d.joursRetards) parties.push(`${d.retards} retards = ${fmtJours(d.joursRetards)} j`);
  return { ...d, montant, detail: montant > 0 ? parties.join(" + ") : "" };
}

// Fiche du secondaire recalculée comme « 🔄 Actualiser » (EDT + heures
// « Absent » du mois, hors jours justifiés), bons et révisions conservés,
// avec sa retenue « Abs. ». null si l'enseignant n'est plus en fiche.
// `ctx` : { ensCollege, ensLycee, emploisCollege, emploisLycee, engCollege,
// engLycee, primeDefaut, presences, anneeScolaire, reglages }.
export function recalculerFicheSecondaire(salaire, ctx = {}) {
  const { presences = [], anneeScolaire, reglages = REGLAGES_DEFAUT } = ctx;
  const tous = [
    ...(ctx.ensCollege || []).map((ens) => ({ ens, emplois: ctx.emploisCollege || [], eng: ctx.engCollege || [] })),
    ...(ctx.ensLycee || []).map((ens) => ({ ens, emplois: ctx.emploisLycee || [], eng: ctx.engLycee || [] })),
  ];
  const t = tous.find((x) => memeNom(buildTeacherFullName(x.ens), salaire.nom));
  if (!t) return null;
  // La prime par défaut de la barre d'outils n'est pas mémorisée : à défaut,
  // celle qui a servi à générer la fiche.
  const primeDefaut = Number(ctx.primeDefaut) || Number(salaire.paramSnapshot?.primeDefaut) || 0;
  const calcule = buildSecondarySalaryRecord(t.ens, {
    mois: salaire.mois,
    emplois: t.emplois,
    enseignements: enseignementsPourPaie(t.eng, { mois: salaire.mois, anneeScolaire, presences }),
    jours5eme: getFifthWeekDays(salaire.mois),
    primeDefaut,
  });
  const retenue = calculerRetenueSecondaire({
    salaire, teacher: t.ens, creneaux: getTeacherScheduleSlots(t.emplois, t.ens),
    enseignementsMois: t.eng.filter((e) => estDuMois(e, salaire.mois, anneeScolaire)),
    presences, reglages, primeDefaut,
  });
  return {
    fiche: { ...mergeSalaryWithManualFields(salaire, calcule), retenueAbsences: retenue.montant, detailAbsences: retenue.detail },
    retenue,
  };
}

const CHAMPS_SUIVIS = ["montantBrut", "nonExecute", "primeHoraire", "retenueAbsences"];
export const ficheModifiee = (avant, apres) =>
  CHAMPS_SUIVIS.some((k) => Number(avant[k] || 0) !== Number(apres[k] || 0))
  || (avant.detailAbsences || "") !== (apres.detailAbsences || "");
