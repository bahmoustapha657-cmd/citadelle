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

// Ordonne des élèves (une ou plusieurs classes) pour l'impression groupée :
// classes regroupées (ordre d'apparition dans `eleves`), puis par CLASSEMENT
// au sein de chaque classe (meilleure moyenne en premier). Élèves sans
// moyenne (aucune note saisie) imprimés en dernier ; à égalité de rang,
// ordre alphabétique. Renvoie aussi `rangParEleve` (Map id→rang) pour éviter
// de recalculer le rang une seconde fois lors de la construction des pages.
export function ordonnerParClassement(eleves, notes, getMatieresClasse, periode, niveau) {
  const rangParEleve = new Map();
  const classesOrdre = [...new Set(eleves.map((e) => e.classe))];
  const ordonnes = classesOrdre.flatMap((cl) => {
    const elevesClasse = eleves.filter((e) => e.classe === cl);
    const matsCl = getMatieresClasse(cl);
    return elevesClasse
      .map((e) => {
        rangParEleve.set(e._id, getRangEleve(e, elevesClasse, notes, matsCl, periode, cl, niveau));
        return e;
      })
      .sort((a, b) => {
        const ra = rangParEleve.get(a._id), rb = rangParEleve.get(b._id);
        if (ra && rb && ra.rang !== rb.rang) return ra.rang - rb.rang;
        if (!!ra !== !!rb) return ra ? -1 : 1;
        return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`);
      });
  });
  return { ordonnes, rangParEleve };
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
