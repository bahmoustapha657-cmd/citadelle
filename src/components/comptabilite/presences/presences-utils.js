// Présences du personnel : absences, retards, permissions… et retenue sur
// salaire qui en découle. Module pur (testable sous Node).
//
// Règles (décidées avec l'école, 2026-10-10) :
//  - seules les absences et retards INJUSTIFIÉS coûtent ; une absence
//    justifiée, une permission, un congé ou une mission sont payés ;
//  - salaire au forfait (Primaire, Personnel) : retenue = forfait ÷ jours
//    ouvrables du mois × jours d'absence (demi-journée = ½) ;
//  - retards : N retards injustifiés = une demi-journée (N réglable) ;
//  - secondaire, payé à l'heure : voir presences-secondaire.js (heures
//    « Absent » d'Enseignements, jours justifiés payés, retenue du reste).
import { TOUS_MOIS_LONGS } from "../../../constants.js";
import { normalizeSalaryName } from "../../../salary-utils";

export const TYPES_PRESENCE = [
  { id: "absence", label: "Absence", icone: "🚫" },
  { id: "retard", label: "Retard", icone: "⏰" },
  { id: "permission", label: "Permission", icone: "📝" },
  { id: "conge", label: "Congé", icone: "🌴" },
  { id: "mission", label: "Mission", icone: "🚗" },
];
// Seuls ces types se justifient (ou non) ; les autres sont autorisés d'office.
export const TYPES_A_JUSTIFIER = new Set(["absence", "retard"]);

export const STATUTS = {
  en_attente: { label: "En attente", couleur: "amber" },
  justifiee: { label: "Justifiée", couleur: "vert" },
  injustifiee: { label: "Injustifiée", couleur: "red" },
};

export const JOURS_SEMAINE = [
  { n: 1, court: "Lun" }, { n: 2, court: "Mar" }, { n: 3, court: "Mer" },
  { n: 4, court: "Jeu" }, { n: 5, court: "Ven" }, { n: 6, court: "Sam" },
];

export const REGLAGES_DEFAUT = Object.freeze({ joursTravail: [1, 2, 3, 4, 5], retardsParDemiJournee: 3 });

// Sections de paie payées au forfait mensuel.
export const SECTIONS_FORFAIT = new Set(["Primaire", "Personnel"]);

// Réglages de l'école, bornés comme côté serveur (maj_reglages_compta).
export function reglagesPresences(schoolInfo = {}) {
  const r = schoolInfo?.reglagesPresences || {};
  const jours = [...new Set((Array.isArray(r.joursTravail) ? r.joursTravail : [])
    .map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 6))].sort((a, b) => a - b);
  const retards = Number(r.retardsParDemiJournee);
  return {
    joursTravail: jours.length ? jours : [...REGLAGES_DEFAUT.joursTravail],
    retardsParDemiJournee: Number.isInteger(retards) && retards >= 1 && retards <= 20
      ? retards : REGLAGES_DEFAUT.retardsParDemiJournee,
  };
}

// « 2026-10-14 » → « Octobre » (mois de paie). "" si la date est invalide.
export function moisDeDate(date) {
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(String(date || ""));
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 12 ? TOUS_MOIS_LONGS[(n + 3) % 12] : "";
}

// Année civile d'un mois de l'année scolaire « 2026-2027 » : septembre →
// décembre la 1re, janvier → août la 2de. null si l'un des deux est inconnu.
export function anneeCivileDuMois(mois, anneeScolaire) {
  const idx = TOUS_MOIS_LONGS.indexOf(mois);
  const debut = Number(String(anneeScolaire || "").slice(0, 4));
  if (idx < 0 || !debut) return null;
  return idx < 4 ? debut : debut + 1;
}

// Nombre de jours travaillés d'un mois (selon les jours de la semaine
// travaillés par l'école). 0 si le mois ou l'année sont inconnus.
export function joursOuvrables(mois, anneeScolaire, joursTravail = REGLAGES_DEFAUT.joursTravail) {
  const annee = anneeCivileDuMois(mois, anneeScolaire);
  if (!annee) return 0;
  const jsMois = (TOUS_MOIS_LONGS.indexOf(mois) + 8) % 12;
  const travailles = new Set(joursTravail);
  const nbJours = new Date(annee, jsMois + 1, 0).getDate();
  let n = 0;
  for (let j = 1; j <= nbJours; j += 1) {
    if (travailles.has(new Date(annee, jsMois, j).getDay())) n += 1;
  }
  return n;
}

const memeAgent = (p, nom, section) =>
  normalizeSalaryName(p.agentNom || "") === normalizeSalaryName(nom || "")
  && String(p.section || "").trim() === String(section || "").trim();

// Faits d'un agent (nom + section de paie) pour un mois de paie.
export function presencesDeLAgent(presences = [], { nom, section, mois }) {
  return presences.filter((p) => memeAgent(p, nom, section) && moisDeDate(p.date) === mois);
}

const dateCourte = (date) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(date || ""));
  return m ? `${m[2]}/${m[1]}` : "";
};
const fmtJours = (j) => String(j).replace(".", ",");

// Décompte d'un agent sur un mois : jours d'absence injustifiée, retards,
// jours retenus, et faits encore en attente de décision.
export function decompteAgent(faits = [], reglages = REGLAGES_DEFAUT) {
  let joursAbsence = 0;
  const datesAbsence = [];
  let retards = 0;
  let enAttente = 0;
  for (const p of faits) {
    if (!TYPES_A_JUSTIFIER.has(p.type)) continue;
    if (p.statut === "en_attente" || !p.statut) { enAttente += 1; continue; }
    if (p.statut !== "injustifiee") continue;
    if (p.type === "absence") {
      joursAbsence += p.duree === "demi" ? 0.5 : 1;
      datesAbsence.push(dateCourte(p.date) + (p.duree === "demi" ? " (½)" : ""));
    } else {
      retards += 1;
    }
  }
  const joursRetards = Math.floor(retards / reglages.retardsParDemiJournee) * 0.5;
  return {
    joursAbsence, datesAbsence: datesAbsence.sort(), retards, joursRetards,
    joursRetenus: joursAbsence + joursRetards, enAttente,
  };
}

// Retenue d'une fiche de paie au forfait. `salaire` : fiche de paie (nom,
// section, mois, montantForfait). Renvoie null pour le secondaire.
export function calculerRetenue(salaire = {}, presences = [], { anneeScolaire, reglages = REGLAGES_DEFAUT } = {}) {
  if (!SECTIONS_FORFAIT.has(salaire.section)) return null;
  const faits = presencesDeLAgent(presences, { nom: salaire.nom, section: salaire.section, mois: salaire.mois });
  const d = decompteAgent(faits, reglages);
  const ouvrables = joursOuvrables(salaire.mois, anneeScolaire, reglages.joursTravail);
  const forfait = Number(salaire.montantForfait || 0);
  const parJour = ouvrables > 0 ? forfait / ouvrables : 0;
  const montant = Math.min(forfait, Math.round(parJour * d.joursRetenus));
  const parties = [];
  if (d.joursAbsence) parties.push(`${fmtJours(d.joursAbsence)} j abs. (${d.datesAbsence.join(", ")})`);
  if (d.retards) parties.push(`${d.retards} retard${d.retards > 1 ? "s" : ""}${d.joursRetards ? ` = ${fmtJours(d.joursRetards)} j` : ""}`);
  const detail = montant > 0
    ? `${parties.join(" + ")} → ${fmtJours(d.joursRetenus)} j × ${Math.round(parJour).toLocaleString("fr-FR")} (forfait ÷ ${ouvrables} j ouvrables)`
    : "";
  return { ...d, ouvrables, parJour, montant, detail };
}

// Agents d'une feuille de présence : [{ nom, section }] toutes sections de
// paie confondues, sans doublon nom+section, triés par section puis nom.
export function agentsFeuille(listeParSection = {}) {
  const res = [];
  for (const [section, noms] of Object.entries(listeParSection)) {
    for (const nom of noms) res.push({ nom, section });
  }
  return res;
}

// Fait déjà saisi pour cet agent à cette date (même type) — la feuille du
// jour ne crée pas de doublon quand on la refait.
export function faitExistant(presences = [], { nom, section, date, type }) {
  return presences.find((p) => p.date === date && p.type === type && memeAgent(p, nom, section)) || null;
}

// Récapitulatif d'un mois : une ligne par agent ayant au moins un fait.
// `retenue` : retenue calculée, `appliquee` : celle portée par sa fiche de
// paie (null si la paie du mois n'est pas générée). `retenueSecondaire` :
// (fiche) => { montant } | null, pour les fiches à l'heure.
export function recapMois({ presences = [], salairesMois = [], mois, anneeScolaire, reglages = REGLAGES_DEFAUT, retenueSecondaire = null }) {
  const agents = new Map();
  for (const p of presences) {
    if (moisDeDate(p.date) !== mois) continue;
    const cle = `${p.section}|${normalizeSalaryName(p.agentNom || "")}`;
    if (!agents.has(cle)) agents.set(cle, { nom: p.agentNom, section: p.section, faits: [] });
    agents.get(cle).faits.push(p);
  }
  return [...agents.values()].map(({ nom, section, faits }) => {
    const fiche = salairesMois.find((s) => s.section === section
      && normalizeSalaryName(s.nom || "") === normalizeSalaryName(nom || "")) || null;
    const calcul = !fiche ? null
      : SECTIONS_FORFAIT.has(section) ? calculerRetenue(fiche, presences, { anneeScolaire, reglages })
        : retenueSecondaire ? retenueSecondaire(fiche) : null;
    return {
      nom, section, nbFaits: faits.length,
      ...decompteAgent(faits, reglages),
      fiche: Boolean(fiche),
      retenue: calcul ? calcul.montant : null,
      appliquee: fiche ? Number(fiche.retenueAbsences || 0) : null,
    };
  }).sort((a, b) => a.section.localeCompare(b.section) || String(a.nom).localeCompare(String(b.nom), "fr"));
}
