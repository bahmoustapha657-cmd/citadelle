// ══════════════════════════════════════════════════════════════
//  Registre d'appel du mois (logique pure) — portail enseignant et École
// ══════════════════════════════════════════════════════════════
// Une grille élèves × jours de classe du mois, comme le registre papier :
// A = absent non justifié, J = absent justifié, R = retard (l'élève est
// venu : il compte présent). Un jour compte une fois par élève, même si deux
// signalements ont été faits (l'enseignant et la direction, par exemple) ;
// une absence l'emporte sur un retard.
//
// Arrêté du registre, à la fin du mois :
//  · présences possibles  = élèves × jours de classe ;
//  · présences effectives = présences possibles − journées d'absence ;
//  · taux de fréquentation = effectives / possibles, en pour cent.
// Jours de classe = jours ouvrés de l'école (Paramètres → Identité), sans le
// dimanche, sans les congés du calendrier scolaire, sans les jours retirés à
// la main par le chef de section (fermeture imprévue), et pas au-delà
// d'aujourd'hui.
import { dateIso } from "../../absences-eleves.js";
import { JOURS_SEMAINE } from "../../constants.js";

const deux = (n) => String(n).padStart(2, "0");
export const cleMois = (date = new Date()) => `${date.getFullYear()}-${deux(date.getMonth() + 1)}`;
const cleJour = (date) => `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;

// Mois de l'année scolaire « 2026-2027 » (septembre → juillet), jusqu'au
// mois en cours. Sans année lisible : les douze derniers mois.
export function moisDeLAnnee(annee = "", aujourdhui = new Date()) {
  const actuel = cleMois(aujourdhui);
  const [debut, fin] = String(annee).split("-").map(Number);
  const liste = [];
  if (Number.isFinite(debut) && Number.isFinite(fin) && fin === debut + 1) {
    for (let i = 0; i < 11; i++) {
      const d = new Date(debut, 8 + i, 1);
      if (cleMois(d) > actuel) break;
      liste.push(cleMois(d));
    }
  }
  if (liste.length) return liste;
  for (let i = 11; i >= 0; i--) liste.push(cleMois(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - i, 1)));
  return liste;
}

// Mois précédent, proposé les premiers jours d'un mois pour l'arrêter.
export const moisPrecedent = (aujourdhui = new Date()) =>
  cleMois(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1));
export const debutDeMois = (aujourdhui = new Date(), jours = 7) => aujourdhui.getDate() <= jours;

// Dernier jour du mois « AAAA-MM-JJ » ; un mois est arrêté quand il est fini.
export function dernierJour(mois) {
  const [a, m] = String(mois).split("-").map(Number);
  return a && m ? `${a}-${deux(m)}-${deux(new Date(a, m, 0).getDate())}` : "";
}
export const estArrete = (mois, aujourdhui = new Date()) => Boolean(mois) && dernierJour(mois) < cleJour(aujourdhui);

// Congés du calendrier scolaire (module Calendrier, type « conge ») qui
// touchent la section : niveau « Tous », vide, ou le libellé de la section.
// Renvoie l'ensemble des dates « AAAA-MM-JJ » couvertes, de `date` à `dateFin`.
export function joursDeConge(evenements = [], libelleSection = "") {
  const jours = new Set();
  for (const ev of evenements) {
    if (ev?.type !== "conge") continue;
    const niveau = String(ev.niveau || "Tous").trim();
    if (niveau !== "Tous" && libelleSection && niveau !== libelleSection) continue;
    const debut = dateIso(ev.date);
    if (!debut) continue;
    const fin = dateIso(ev.dateFin) || debut;
    const [a, m, j] = debut.split("-").map(Number);
    // Garde-fou : une date de fin aberrante ne fait pas tourner la boucle sans fin.
    for (let d = new Date(a, m - 1, j), n = 0; cleJour(d) <= fin && n < 400; d.setDate(d.getDate() + 1), n++) {
      jours.add(cleJour(d));
    }
  }
  return jours;
}

// Jours de classe du mois. `retires` : congés et jours retirés à la main.
export function joursDeClasse(mois, joursOuvrables = JOURS_SEMAINE, aujourdhui = new Date(), retires = new Set()) {
  const [a, m] = String(mois).split("-").map(Number);
  if (!a || !m) return [];
  const ouvres = new Set(joursOuvrables);
  const limite = cleJour(aujourdhui);
  const jours = [];
  for (let j = 1; j <= new Date(a, m, 0).getDate(); j++) {
    const date = `${a}-${deux(m)}-${deux(j)}`;
    if (date > limite) break;
    const semaine = new Date(a, m - 1, j).getDay(); // 0 = dimanche
    if (semaine === 0 || !ouvres.has(JOURS_SEMAINE[semaine - 1]) || retires.has(date)) continue;
    jours.push({ date, jour: j, semaine });
  }
  return jours;
}

const MARQUE = (inc) => {
  if (inc.type === "Absence") return inc.justifie === "Oui" ? "J" : "A";
  if (inc.type === "Retard") return "R";
  return "";
};
const PRIORITE = { A: 3, J: 2, R: 1 };
const estAbsence = (marque) => marque === "A" || marque === "J";

// Taux en pour cent, une décimale (« 96,4 » s'affiche selon la langue).
export const taux = (effectives, possibles) =>
  (possibles > 0 ? Math.round((effectives / possibles) * 1000) / 10 : 0);

// `eleves` : ceux de la classe ; `incidents` : tous les signalements lus.
// `conges` : dates retirées (joursDeConge) ; `exclus` : dates retirées à la main.
// Un signalement tombé un jour sans classe (congé, dimanche, saisie erronée)
// n'entre ni dans la grille ni dans les totaux : il est compté à part
// (`horsJours`), pour que l'arrêté reste juste.
export function registreMensuel({
  eleves = [], incidents = [], mois = "", joursOuvrables, aujourdhui = new Date(),
  conges = new Set(), exclus = [],
}) {
  const retires = new Set([...conges, ...exclus]);
  const jours = joursDeClasse(mois, joursOuvrables, aujourdhui, retires);
  const datesClasse = new Set(jours.map((j) => j.date));
  const ids = new Set(eleves.map((e) => e._id));
  const marques = new Map(); // eleveId → Map(date → marque)
  const horsJours = new Set();
  for (const inc of incidents) {
    const marque = MARQUE(inc);
    const date = dateIso(inc.date);
    if (!marque || !ids.has(inc.eleveId) || date.slice(0, 7) !== mois) continue;
    if (!datesClasse.has(date)) { horsJours.add(`${inc.eleveId}|${date}`); continue; }
    const parJour = marques.get(inc.eleveId) || new Map();
    if ((PRIORITE[marque] || 0) > (PRIORITE[parJour.get(date)] || 0)) parJour.set(date, marque);
    marques.set(inc.eleveId, parJour);
  }

  const lignes = [...eleves]
    .sort((a, b) => `${a.nom || ""} ${a.prenom || ""}`.localeCompare(`${b.nom || ""} ${b.prenom || ""}`, "fr", { sensitivity: "base" }))
    .map((eleve) => {
      const parJour = marques.get(eleve._id) || new Map();
      const compte = (m) => [...parJour.values()].filter((v) => v === m).length;
      const ligne = { eleve, marques: Object.fromEntries(parJour), absNJ: compte("A"), absJ: compte("J"), retards: compte("R") };
      ligne.total = ligne.absNJ + ligne.absJ + ligne.retards;
      ligne.presences = jours.length - ligne.absNJ - ligne.absJ;
      return ligne;
    });

  const parJour = Object.fromEntries(jours.map(({ date }) => {
    const absents = lignes.filter((l) => estAbsence(l.marques[date])).length;
    return [date, {
      possibles: lignes.length,
      absents,
      presents: lignes.length - absents,
      retards: lignes.filter((l) => l.marques[date] === "R").length,
    }];
  }));
  const possibles = lignes.length * jours.length;
  const absences = lignes.reduce((s, l) => s + l.absNJ + l.absJ, 0);
  const totaux = {
    absNJ: lignes.reduce((s, l) => s + l.absNJ, 0),
    absJ: lignes.reduce((s, l) => s + l.absJ, 0),
    retards: lignes.reduce((s, l) => s + l.retards, 0),
    elevesConcernes: lignes.filter((l) => l.total > 0).length,
    possibles,
    effectives: possibles - absences,
    taux: taux(possibles - absences, possibles),
  };
  const congesDuMois = [...conges].filter((d) => d.slice(0, 7) === mois && d <= cleJour(aujourdhui)).length;
  return {
    mois, jours, lignes, parJour, totaux,
    arrete: estArrete(mois, aujourdhui),
    horsJours: horsJours.size,
    congesRetires: congesDuMois,
  };
}

// Les élèves à suivre en premier : les plus absents (non justifié d'abord).
export const lignesAuSuivi = (registre) => registre.lignes
  .filter((l) => l.total > 0)
  .sort((a, b) => b.absNJ - a.absNJ || b.absJ - a.absJ || b.retards - a.retards);

// « novembre 2026 », dans la langue affichée.
export function libelleMois(mois, langue = "fr") {
  const [a, m] = String(mois).split("-").map(Number);
  if (!a || !m) return String(mois || "");
  try {
    return new Date(a, m - 1, 1).toLocaleDateString(langue, { month: "long", year: "numeric" });
  } catch {
    return mois;
  }
}

// « 30 novembre 2026 », dans la langue affichée.
export function libelleDate(date, langue = "fr") {
  if (!date) return "";
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString(langue, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return date;
  }
}

export const formaterTaux = (valeur, langue = "fr") => {
  try {
    return Number(valeur).toLocaleString(langue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  } catch {
    return String(valeur);
  }
};
