// ══════════════════════════════════════════════════════════════
//  Bulletins — helpers de calcul (rang, stats classe, évolution)
// ══════════════════════════════════════════════════════════════
// Les helpers de présentation (mention, couleurs, n°…) vivent dans
// bulletin-format.js.
import { getGeneralAverage, getSubjectAverage } from "../../note-utils.js";
import { getPeriodesForSection } from "../../period-utils.js";

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
