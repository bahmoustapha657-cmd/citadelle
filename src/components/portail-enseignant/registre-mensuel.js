// ══════════════════════════════════════════════════════════════
//  Portail Enseignant — registre d'appel du mois (logique pure)
// ══════════════════════════════════════════════════════════════
// Une grille élèves × jours de classe du mois, comme le registre papier :
// A = absent non justifié, J = absent justifié, R = retard. Un jour compte
// une fois par élève, même si deux signalements ont été faits (l'enseignant
// et la direction, par exemple) ; une absence l'emporte sur un retard.
import { dateIso } from "../../absences-eleves.js";
import { JOURS_SEMAINE } from "../../constants.js";

const deux = (n) => String(n).padStart(2, "0");
export const cleMois = (date = new Date()) => `${date.getFullYear()}-${deux(date.getMonth() + 1)}`;

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

// Mois précédent, proposé les premiers jours d'un mois pour l'imprimer.
export const moisPrecedent = (aujourdhui = new Date()) =>
  cleMois(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1));
export const debutDeMois = (aujourdhui = new Date(), jours = 7) => aujourdhui.getDate() <= jours;

// Jours de classe du mois : ceux des jours ouvrés de l'école (Paramètres →
// Identité), jamais le dimanche, et pas au-delà d'aujourd'hui.
export function joursDeClasse(mois, joursOuvrables = JOURS_SEMAINE, aujourdhui = new Date()) {
  const [a, m] = String(mois).split("-").map(Number);
  if (!a || !m) return [];
  const ouvres = new Set(joursOuvrables);
  const limite = `${aujourdhui.getFullYear()}-${deux(aujourdhui.getMonth() + 1)}-${deux(aujourdhui.getDate())}`;
  const jours = [];
  for (let j = 1; j <= new Date(a, m, 0).getDate(); j++) {
    const date = `${a}-${deux(m)}-${deux(j)}`;
    if (date > limite) break;
    const semaine = new Date(a, m - 1, j).getDay(); // 0 = dimanche
    if (semaine === 0 || !ouvres.has(JOURS_SEMAINE[semaine - 1])) continue;
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

// `eleves` : ceux de la classe ; `incidents` : tous ceux du portail.
// Un signalement tombé un jour sans classe (samedi saisi par erreur…) compte
// quand même : il figure dans les totaux, et le jour s'ajoute à la grille.
export function registreMensuel({ eleves = [], incidents = [], mois = "", joursOuvrables, aujourdhui = new Date() }) {
  const ids = new Set(eleves.map((e) => e._id));
  const marques = new Map(); // eleveId → Map(date → marque)
  for (const inc of incidents) {
    const marque = MARQUE(inc);
    const date = dateIso(inc.date);
    if (!marque || !ids.has(inc.eleveId) || date.slice(0, 7) !== mois) continue;
    const parJour = marques.get(inc.eleveId) || new Map();
    if ((PRIORITE[marque] || 0) > (PRIORITE[parJour.get(date)] || 0)) parJour.set(date, marque);
    marques.set(inc.eleveId, parJour);
  }

  const jours = joursDeClasse(mois, joursOuvrables, aujourdhui);
  const connus = new Set(jours.map((j) => j.date));
  for (const parJour of marques.values()) {
    for (const date of parJour.keys()) {
      if (connus.has(date)) continue;
      connus.add(date);
      const [a, m, j] = date.split("-").map(Number);
      jours.push({ date, jour: j, semaine: new Date(a, m - 1, j).getDay() });
    }
  }
  jours.sort((x, y) => x.date.localeCompare(y.date));

  const lignes = [...eleves]
    .sort((a, b) => `${a.nom || ""} ${a.prenom || ""}`.localeCompare(`${b.nom || ""} ${b.prenom || ""}`, "fr", { sensitivity: "base" }))
    .map((eleve) => {
      const parJour = marques.get(eleve._id) || new Map();
      const compte = (m) => [...parJour.values()].filter((v) => v === m).length;
      const ligne = { eleve, marques: Object.fromEntries(parJour), absNJ: compte("A"), absJ: compte("J"), retards: compte("R") };
      ligne.total = ligne.absNJ + ligne.absJ + ligne.retards;
      return ligne;
    });

  const parJour = Object.fromEntries(jours.map(({ date }) => [date, {
    absents: lignes.filter((l) => l.marques[date] === "A" || l.marques[date] === "J").length,
    retards: lignes.filter((l) => l.marques[date] === "R").length,
  }]));
  const totaux = {
    absNJ: lignes.reduce((s, l) => s + l.absNJ, 0),
    absJ: lignes.reduce((s, l) => s + l.absJ, 0),
    retards: lignes.reduce((s, l) => s + l.retards, 0),
    elevesConcernes: lignes.filter((l) => l.total > 0).length,
  };
  return { mois, jours, lignes, parJour, totaux };
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
