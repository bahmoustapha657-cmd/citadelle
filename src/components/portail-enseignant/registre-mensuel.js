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
//
// Au secondaire, l'appel se fait par cours : le registre compte alors en
// HEURES de cours (registreMensuelHeures) — heures possibles = élèves × heures
// de cours de la classe (emploi du temps), heures suivies = possibles −
// heures manquées. Une absence sans heure (direction, anciennes absences)
// vaut pour tous les cours de la journée.
import { dateIso } from "../../absences-eleves.js";
import { JOURS_SEMAINE } from "../../constants.js";
import { cleSeance, dureeMinutes, recouvrement, seanceValide, seancesDuJour } from "./seances.js";

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

// ── Registre en heures (secondaire, appel par cours) ────────────────────────
// `creneaux` : l'emploi du temps de la classe (ou, pour l'aperçu d'un
// professeur, ses seuls cours dans la classe). Pour chaque jour de classe,
// ses cours ; un élève manque un cours si une absence le recouvre (même en
// partie) ou s'il est absent toute la journée. Un cours manqué compte pour
// toute sa durée ; justifié s'il n'est recouvert que par des absences
// justifiées. Un retard (sans absence au même cours) compte présent.
// marques[date] = { nj, j, r } : minutes non justifiées, justifiées, retards.
export function registreMensuelHeures({
  eleves = [], incidents = [], mois = "", joursOuvrables, aujourdhui = new Date(),
  conges = new Set(), exclus = [], creneaux = [],
}) {
  const retires = new Set([...conges, ...exclus]);
  const jours = joursDeClasse(mois, joursOuvrables, aujourdhui, retires)
    .map((j) => {
      const cours = seancesDuJour(creneaux, "", j.date);
      return { ...j, cours, minutes: cours.reduce((s, c) => s + dureeMinutes(c), 0) };
    })
    .filter((j) => j.minutes > 0);
  const parDate = new Map(jours.map((j) => [j.date, j]));
  const ids = new Set(eleves.map((e) => e._id));
  // eleveId → Map(date → signalements du jour)
  const signalements = new Map();
  const horsJours = new Set();
  for (const inc of incidents) {
    if (!MARQUE(inc) || !ids.has(inc.eleveId)) continue;
    const date = dateIso(inc.date);
    if (date.slice(0, 7) !== mois) continue;
    const jour = parDate.get(date);
    const touche = jour && (!seanceValide(inc) || jour.cours.some((c) => recouvrement(c, inc) > 0));
    if (!touche) { horsJours.add(`${inc.eleveId}|${date}|${cleSeance(inc)}`); continue; }
    const parJour = signalements.get(inc.eleveId) || new Map();
    parJour.set(date, [...(parJour.get(date) || []), inc]);
    signalements.set(inc.eleveId, parJour);
  }

  const couvre = (inc, cours) => !seanceValide(inc) || recouvrement(cours, inc) > 0;
  const lignes = [...eleves]
    .sort((a, b) => `${a.nom || ""} ${a.prenom || ""}`.localeCompare(`${b.nom || ""} ${b.prenom || ""}`, "fr", { sensitivity: "base" }))
    .map((eleve) => {
      const marques = {};
      for (const [date, liste] of signalements.get(eleve._id) || []) {
        const marque = { nj: 0, j: 0, r: 0 };
        for (const cours of parDate.get(date).cours) {
          const sur = liste.filter((inc) => couvre(inc, cours));
          const absences = sur.filter((inc) => inc.type === "Absence");
          if (absences.length) {
            if (absences.some((inc) => inc.justifie !== "Oui")) marque.nj += dureeMinutes(cours);
            else marque.j += dureeMinutes(cours);
          } else if (sur.some((inc) => inc.type === "Retard")) marque.r += 1;
        }
        if (marque.nj || marque.j || marque.r) marques[date] = marque;
      }
      const somme = (cle) => Object.values(marques).reduce((s, m) => s + m[cle], 0);
      const ligne = { eleve, marques, absNJ: somme("nj"), absJ: somme("j"), retards: somme("r") };
      ligne.total = ligne.absNJ + ligne.absJ + ligne.retards;
      ligne.presences = jours.reduce((s, j) => s + j.minutes, 0) - ligne.absNJ - ligne.absJ;
      return ligne;
    });

  const parJour = Object.fromEntries(jours.map(({ date, minutes }) => {
    const possibles = lignes.length * minutes;
    const absents = lignes.reduce((s, l) => s + (l.marques[date]?.nj || 0) + (l.marques[date]?.j || 0), 0);
    return [date, {
      possibles, absents, presents: possibles - absents,
      retards: lignes.reduce((s, l) => s + (l.marques[date]?.r || 0), 0),
    }];
  }));
  const possibles = lignes.length * jours.reduce((s, j) => s + j.minutes, 0);
  const absences = lignes.reduce((s, l) => s + l.absNJ + l.absJ, 0);
  return {
    unite: "heures", mois, jours, lignes, parJour,
    totaux: {
      absNJ: lignes.reduce((s, l) => s + l.absNJ, 0),
      absJ: lignes.reduce((s, l) => s + l.absJ, 0),
      retards: lignes.reduce((s, l) => s + l.retards, 0),
      elevesConcernes: lignes.filter((l) => l.total > 0).length,
      possibles, effectives: possibles - absences, taux: taux(possibles - absences, possibles),
    },
    arrete: estArrete(mois, aujourdhui),
    horsJours: horsJours.size,
    congesRetires: [...conges].filter((d) => d.slice(0, 7) === mois && d <= cleJour(aujourdhui)).length,
  };
}

// Registre d'une classe : en heures au secondaire quand l'emploi du temps de
// la classe a des cours, sinon par journée (primaire, emploi du temps vide).
export function registreDuMois({ parCours = false, creneaux = [], ...options }) {
  if (parCours && creneaux.some(seanceValide)) return registreMensuelHeures({ creneaux, ...options });
  return { ...registreMensuel(options), unite: "jours", sansEmploiDuTemps: parCours };
}

// Quantité affichée : un nombre de journées, ou des heures (« 12,5 h »).
export function formaterQuantite(valeur, unite = "jours", langue = "fr") {
  if (unite !== "heures") return Number(valeur || 0).toLocaleString(langue);
  const heures = Math.round((Number(valeur || 0) / 60) * 10) / 10;
  try {
    return `${heures.toLocaleString(langue, { maximumFractionDigits: 1 })} h`;
  } catch {
    return `${heures} h`;
  }
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
