// Helpers purs de l'emploi du temps extraits de EmploiDuTempsTab.jsx
// (découpage 2026-05-29).

export const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export const COULEURS = ["#dbeafe", "#dcfce7", "#fef9c3", "#ffe4e6", "#f3e8ff", "#ffedd5", "#e0f2fe", "#d1fae5", "#fce7f3", "#ecfdf5"];

export const SOUS_LABELS = ["Matière", "Enseignant", "Salle"];

const NIVEAUX_ORDER = [
  "maternelle", "ps", "ms", "gs", "petite section", "moyenne section", "grande section",
  "cp", "cp1", "cp2",
  "ce", "ce1", "ce2",
  "cm", "cm1", "cm2",
  "6ème", "6e", "6", "6eme",
  "5ème", "5e", "5", "5eme",
  "4ème", "4e", "4", "4eme",
  "3ème", "3e", "3", "3eme",
  "7ème", "7e", "7", "7eme",
  "8ème", "8e", "8", "8eme",
  "9ème", "9e", "9", "9eme",
  "10ème", "10e", "10", "10eme",
  "11ème", "11e", "11", "11eme",
  "seconde", "2nde", "2nd",
  "12ème", "12e", "12", "12eme",
  "première", "premiere", "1ère", "1ere",
  "13ème", "13e", "13", "13eme",
  "terminale", "tle", "term",
];

export function niveauRank(nom) {
  const n = (nom || "").toLowerCase().trim();
  const idx = NIVEAUX_ORDER.findIndex((o) => n === o || n.startsWith(o + " ") || n.startsWith(o + "-") || n.startsWith(o + "_"));
  if (idx >= 0) return idx * 10;
  const m = n.match(/^(\d+)/);
  if (m) return 500 + parseInt(m[1]);
  return 999;
}

export function genTranches(step, heureDebut, heureFin) {
  const [sh, sm] = (heureDebut || "08:00").split(":").map(Number);
  const [eh, em] = (heureFin || "14:00").split(":").map(Number);
  const t = [];
  let h = sh, m = sm;
  while (h * 60 + m <= eh * 60 + em) {
    t.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
    m += step;
    h += Math.floor(m / 60);
    m = m % 60;
  }
  return t;
}

export const affNom = (nomStr) => nomStr ? nomStr.replace(/\s*\([^)]*\)$/, "") : "";

// Nombre de sous-lignes d'un créneau dans l'EDT général : la 10e tranche
// (index 9) en a 4, les autres 3.
export const nbSousLignes = (ti) => ti === 9 ? 4 : 3;

export const totalLignesClasse = (nbTranches) => {
  let t = 0;
  for (let i = 0; i < nbTranches; i++) t += nbSousLignes(i);
  return t;
};

// Fabrique un chercheur d'enseignant par nom complet (ou nom + matière).
export const makeFindEns = (ens) => (nomStr) => ens.find((e) => {
  if (!nomStr) return false;
  const full = `${e.prenom || ""} ${e.nom || ""}`.trim();
  return nomStr === full || nomStr.startsWith(full + " (");
});
