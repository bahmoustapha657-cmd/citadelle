// ══════════════════════════════════════════════════════════════
//  Bulletins — helpers de calcul (rang, stats classe, évolution)
// ══════════════════════════════════════════════════════════════
// Les helpers de présentation (mention, couleurs, n°…) vivent dans
// bulletin-format.js.
import { getGeneralAverage, getSubjectAverage } from "../../note-utils.js";
import { notesDeLEleve } from "../../note-index.js";
import { getPeriodesForSection } from "../../period-utils.js";

export function getStatsClasse(elevesClasse, notes, matieres, periode, classe, niveau) {
  const moyennes = elevesClasse
    .map((e) => {
      const notesE = notesDeLEleve(notes, e._id, periode);
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
      const nm = notesDeLEleve(notes, e._id, periode).filter((n) => n.matiere === matiereNom);
      return getSubjectAverage(nm, classe, niveau);
    })
    .filter((v) => v != null);
  return moyennes.length ? moyennes.reduce((s, v) => s + v, 0) / moyennes.length : null;
}

export function getRangEleve(eleve, elevesClasse, notes, matieres, periode, classe, niveau) {
  const avecMoy = elevesClasse
    .map((e) => {
      const notesE = notesDeLEleve(notes, e._id, periode);
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

// Rang de chaque élève dans chaque matière : Map matière → Map eleveId → rang.
// Mêmes règles que le rang général (ex aequo au même rang, élèves sans
// moyenne dans la matière non classés).
export function getRangsParMatiere(elevesClasse, notes, matieres, periode, classe, niveau) {
  const rangs = new Map();
  for (const mat of matieres) {
    const avecMoy = elevesClasse
      .map((e) => ({
        id: e._id,
        moy: getSubjectAverage(notesDeLEleve(notes, e._id, periode).filter((n) => n.matiere === mat.nom), classe, niveau),
      }))
      .filter((x) => x.moy != null)
      .sort((a, b) => b.moy - a.moy);
    const parEleve = new Map();
    avecMoy.forEach((x, i) => {
      parEleve.set(x.id, i > 0 && x.moy === avecMoy[i - 1].moy ? parEleve.get(avecMoy[i - 1].id) : i + 1);
    });
    rangs.set(mat.nom, parEleve);
  }
  return rangs;
}

// Professeur de chaque matière d'une classe : l'emploi du temps fait foi ;
// à défaut, celui qui a saisi le plus de notes de la matière pour ces élèves
// pendant la période. Map matière → nom (absente si inconnu).
export function getProfesseursParMatiere({ classe, matieres, eleveIds, notes, periode, emplois = [] }) {
  const plusFrequent = (noms) => {
    const compte = new Map();
    for (const nom of noms) {
      const n = String(nom || "").trim();
      if (n) compte.set(n, (compte.get(n) || 0) + 1);
    }
    let meilleur = "", max = 0;
    for (const [nom, c] of compte) if (c > max) { meilleur = nom; max = c; }
    return meilleur;
  };
  const ids = new Set(eleveIds);
  const notesClasse = notes.filter((n) => ids.has(n.eleveId) && (periode == null || n.periode === periode));
  const profs = new Map();
  for (const mat of matieres) {
    const nom = plusFrequent(emplois.filter((c) => c.classe === classe && c.matiere === mat.nom).map((c) => c.enseignant))
      || plusFrequent(notesClasse.filter((n) => n.matiere === mat.nom).map((n) => n.enseignantNom));
    if (nom) profs.set(mat.nom, nom);
  }
  return profs;
}

// Moyenne générale de l'élève à chaque période de la section, dans l'ordre :
// [{ periode, moy }] (moy null si rien de noté). Sert à la courbe de
// progression et au récapitulatif du bulletin annuel — d'où les notes
// RÉELLES, jamais les notes annuelles synthétiques.
export function getMoyennesPeriodes(eleve, notes, matieres, classe, niveau, periodes = []) {
  // getGeneralAverage vaut 0 (pas null) sans aucune note : une période pas
  // encore commencée doit rester vide, pas tomber à zéro sur la courbe.
  return periodes.map((periode) => {
    const notesP = notesDeLEleve(notes, eleve._id, periode);
    return { periode, moy: notesP.length ? getGeneralAverage(notesP, matieres, classe, niveau) : null };
  });
}

export function getEvolutionPeriode(eleve, allNotes, matieres, classe, niveau, periodeActuelle, schoolInfo = {}) {
  const sectionPeriode = niveau;
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode);
  const idx = periodes.indexOf(periodeActuelle);
  if (idx <= 0) return null;
  const periodePrec = periodes[idx - 1];
  const notesActu = notesDeLEleve(allNotes, eleve._id, periodeActuelle);
  const notesPrec = notesDeLEleve(allNotes, eleve._id, periodePrec);
  const moyActu = getGeneralAverage(notesActu, matieres, classe, niveau);
  const moyPrec = getGeneralAverage(notesPrec, matieres, classe, niveau);
  if (moyActu == null || moyPrec == null) return null;
  return { periodePrec, moyPrec, moyActu, ecart: moyActu - moyPrec };
}
