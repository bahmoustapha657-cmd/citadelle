// Emploi du temps en LECTURE des portails (enseignant, parent) : fonctions
// pures partagées par l'écran (EdtSemaine) et l'impression A4.
// La saisie, elle, vit dans components/ecole/edt.

import { JOURS_SEMAINE } from "./constants";
import { genTranchesAdaptatives, planifierJour, affNom } from "./components/ecole/edt/edt-utils";

export { planifierJour, affNom };

// Fonds pastel des créneaux, puis couleur du trait et du texte assortis.
const PALETTE = [
  { fond: "#dbeafe", trait: "#3b82f6", texte: "#1e3a8a" },
  { fond: "#dcfce7", trait: "#22c55e", texte: "#14532d" },
  { fond: "#fef9c3", trait: "#eab308", texte: "#713f12" },
  { fond: "#ffe4e6", trait: "#f43f5e", texte: "#881337" },
  { fond: "#f3e8ff", trait: "#a855f7", texte: "#581c87" },
  { fond: "#ffedd5", trait: "#f97316", texte: "#7c2d12" },
  { fond: "#e0f2fe", trait: "#0ea5e9", texte: "#0c4a6e" },
  { fond: "#ccfbf1", trait: "#14b8a6", texte: "#134e4a" },
  { fond: "#fce7f3", trait: "#ec4899", texte: "#831843" },
  { fond: "#e2e8f0", trait: "#64748b", texte: "#1e293b" },
];
export const COULEUR_RECREATION = { fond: "#ecfdf5", trait: "#10b981", texte: "#047857" };
export const COULEUR_REVISION = { fond: "#fff7ed", trait: "#f97316", texte: "#9a3412" };

// Anciennes saisies : un seul champ `heure` (« 08:00 - 10:00 »). On en tire
// début et fin pour que ces créneaux trouvent aussi leur place dans la grille.
export function normaliserCreneau(c) {
  if (c.heureDebut || !c.heure) return c;
  const [debut, fin] = String(c.heure).split(/\s*[-–à]\s*/);
  return { ...c, heureDebut: (debut || "").trim(), heureFin: (fin || "").trim() };
}

const hm = (v) => String(v || "").slice(0, 5);
export const horaire = (c) => [hm(c.heureDebut), hm(c.heureFin)].filter(Boolean).join(" – ") || c.heure || "—";

// Créneaux d'un jour, dans l'ordre de la journée.
export const creneauxDuJour = (emplois, jour) =>
  emplois.filter((c) => c.jour === jour)
    .sort((a, b) => String(a.heureDebut || "").localeCompare(String(b.heureDebut || "")));

// Colonnes : jours ouvrés de l'école, plus tout jour où un créneau existe
// (un cours du samedi n'est jamais escamoté), dans l'ordre de la semaine.
export function joursAffiches(emplois, joursOuvrables = JOURS_SEMAINE) {
  const avecCours = new Set(emplois.map((c) => c.jour));
  return JOURS_SEMAINE.filter((j) => joursOuvrables.includes(j) || avecCours.has(j));
}

// Jour de la semaine d'aujourd'hui (« Lundi »…), null le dimanche.
export function jourCourant(date = new Date()) {
  return JOURS_SEMAINE[date.getDay() - 1] || null;
}

// Lignes de la grille : pas d'une heure ancré sur 08:00, resserré sur la
// journée réelle et complété par les débuts/fins effectivement saisis.
export const tranchesPortail = (emplois) => genTranchesAdaptatives(60, "08:00", "14:00", emplois, true);

// Une couleur stable par valeur (classe pour l'enseignant, matière pour le
// parent) : les valeurs sont triées pour que la teinte ne change pas d'un
// chargement à l'autre.
export function palettePour(emplois, cle) {
  const valeurs = [...new Set(emplois.map((c) => c[cle]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const table = new Map(valeurs.map((v, i) => [v, PALETTE[i % PALETTE.length]]));
  return (c) => {
    if (c.type === "recreation") return COULEUR_RECREATION;
    if (c.type === "revision") return COULEUR_REVISION;
    return table.get(c[cle]) || PALETTE[PALETTE.length - 1];
  };
}

// Texte d'une case selon le portail :
//  - enseignant : la CLASSE d'abord (c'est ce qu'il cherche), puis la matière ;
//  - parent     : la MATIÈRE d'abord, puis l'enseignant.
export function libellesCreneau(c, mode, matiereParDefaut = "") {
  if (c.type === "recreation") return { titre: c.matiere || "Récréation", detail: "" };
  if (mode === "enseignant") return { titre: c.classe || "—", detail: c.matiere || matiereParDefaut || "" };
  return { titre: c.matiere || "—", detail: affNom(c.enseignant) };
}

// Heures de cours de la semaine (récréations exclues).
export function heuresSemaine(emplois) {
  let minutes = 0;
  for (const c of emplois) {
    if (c.type === "recreation") continue;
    const [h1, m1] = hm(c.heureDebut).split(":").map(Number);
    const [h2, m2] = hm(c.heureFin).split(":").map(Number);
    const d = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (Number.isFinite(d) && d > 0) minutes += d;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
