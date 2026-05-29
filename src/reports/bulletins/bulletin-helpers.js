// ══════════════════════════════════════════════════════════════
//  Bulletins — helpers de calcul (mention, rang, stats, évolution)
// ══════════════════════════════════════════════════════════════
import { getAnnee } from "../../constants.js";
import { getGeneralAverage, getSubjectAverage } from "../../note-utils.js";
import { getPeriodesForSection } from "../../period-utils.js";

export function getMention(moy, maxNote) {
  if (moy === "—" || moy == null || moy === "") return "Non évalué";
  const v = Number(moy);
  if (!Number.isFinite(v)) return "Non évalué";
  if (v >= maxNote * 0.8) return "Très Bien";
  if (v >= maxNote * 0.7) return "Bien";
  if (v >= maxNote * 0.6) return "Assez Bien";
  if (v >= maxNote * 0.5) return "Passable";
  return "Insuffisant";
}

export function getMentionColors(mention) {
  switch (mention) {
    case "Très Bien":  return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
    case "Bien":       return { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" };
    case "Assez Bien": return { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" };
    case "Passable":   return { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" };
    case "Insuffisant":return { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" };
    default:           return { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" };
  }
}

export function getInitiales(eleve = {}) {
  const p = (eleve.prenom || "").trim()[0] || "";
  const n = (eleve.nom || "").trim()[0] || "";
  return (p + n).toUpperCase() || "•";
}

export function getNumeroBulletin(eleve, periode, schoolInfo, annee) {
  const code = String(schoolInfo.nom || "ECO").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "ECO";
  const an = String(annee || getAnnee()).split("-")[0].slice(-2);
  const per = String(periode).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const ref = eleve.matricule || (String(eleve._id || "").slice(-6).toUpperCase());
  return `BUL-${code}-${an}-${per}-${ref}`;
}

export function ordinalFr(rang) {
  return rang === 1 ? "er" : "e";
}

export function getStatsClasse(elevesClasse, notes, matieres, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periode);
      return getGeneralAverage(notesE, matieres, classe, niveau);
    })
    .filter((v) => v != null);
  if (moyennes.length === 0) return null;
  const sum = moyennes.reduce((s, v) => s + v, 0);
  return {
    effectif: elevesClasse.length,
    nbEvalues: moyennes.length,
    moyenneClasse: sum / moyennes.length,
    min: Math.min(...moyennes),
    max: Math.max(...moyennes),
  };
}

export function getMoyenneClasseParMatiere(elevesClasse, notes, matiereNom, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const nm = notes.filter((n) => n.eleveId === e._id && n.periode === periode && n.matiere === matiereNom);
      return getSubjectAverage(nm, classe, niveau);
    })
    .filter((v) => v != null);
  return moyennes.length ? moyennes.reduce((s, v) => s + v, 0) / moyennes.length : null;
}

export function getRangEleve(eleve, elevesClasse, notes, matieres, periode, classe, niveau) {
  const avecMoy = elevesClasse
    .map((e) => {
      const notesE = notes.filter((n) => n.eleveId === e._id && n.periode === periode);
      return { id: e._id, moy: getGeneralAverage(notesE, matieres, classe, niveau) };
    })
    .filter((x) => x.moy != null);
  if (avecMoy.length === 0) return null;
  avecMoy.sort((a, b) => b.moy - a.moy);
  let rang = 1;
  for (let i = 0; i < avecMoy.length; i++) {
    if (i > 0 && avecMoy[i].moy < avecMoy[i - 1].moy) rang = i + 1;
    if (avecMoy[i].id === eleve._id) return { rang, effectif: avecMoy.length };
  }
  return null;
}

export function getEvolutionPeriode(eleve, allNotes, matieres, classe, niveau, periodeActuelle, schoolInfo = {}) {
  const sectionPeriode = niveau === "primaire" ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode);
  const idx = periodes.indexOf(periodeActuelle);
  if (idx <= 0) return null;
  const periodePrec = periodes[idx - 1];
  const notesActu = allNotes.filter((n) => n.eleveId === eleve._id && n.periode === periodeActuelle);
  const notesPrec = allNotes.filter((n) => n.eleveId === eleve._id && n.periode === periodePrec);
  const moyActu = getGeneralAverage(notesActu, matieres, classe, niveau);
  const moyPrec = getGeneralAverage(notesPrec, matieres, classe, niveau);
  if (moyActu == null || moyPrec == null) return null;
  return { periodePrec, moyPrec, moyActu, ecart: moyActu - moyPrec };
}
