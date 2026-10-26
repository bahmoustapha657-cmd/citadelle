// ══════════════════════════════════════════════════════════════
//  Bulletins « Officiel », « Prestige », « Contemporain » — modèle de données
// ══════════════════════════════════════════════════════════════
// Tout ce que les trois gabarits impriment, calculé une fois et sans DOM :
// détail note de classe / composition, points, rang et professeur par
// matière, total des points, distinction proposée au conseil. Les moyennes
// sont EXACTEMENT celles des autres modèles (getSubjectAverage /
// getGeneralAverage) : seule la présentation change.
import { getGeneralAverage, getSubjectAverage, getSubjectParts } from "../../note-utils.js";
import { notesDeLEleve } from "../../note-index.js";
import { estEvaluee } from "../../matiere-nature.js";
import { getMention, getNumeroBulletin } from "./bulletin-format.js";
import { PERIODE_ANNEE } from "./annual-notes.js";

// Distinction proposée au conseil de classe, alignée sur les mentions (en
// pourcentage du barème, donc valable sur 10 comme sur 20) : Très bien →
// Félicitations, Bien → Tableau d'honneur, Assez bien → Encouragements.
// Les sanctions (avertissement, blâme) ne sont jamais cochées d'office : elles
// restent une décision du conseil, à cocher à la main.
export function getDistinction(moy, maxNote) {
  if (moy == null || !Number.isFinite(moy)) return null;
  if (moy >= maxNote * 0.8) return "felicitations";
  if (moy >= maxNote * 0.7) return "honneur";
  if (moy >= maxNote * 0.6) return "encouragements";
  return null;
}

// `rangsParMatiere` (Map matière → Map eleveId → rang) et `professeurs`
// (Map matière → nom) sont facultatifs : sans eux (bulletin imprimé depuis le
// portail parent, sans la classe), les colonnes correspondantes disparaissent.
export function computeBulletinProModel({
  eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, annee,
  matiereClasseAvg = {}, rangsParMatiere = null, professeurs = null,
}) {
  const notesEleve = notesDeLEleve(notes, eleve._id, periode);
  // Rubriques « enseignées seulement » : jamais notées, jamais au bulletin.
  const evaluees = matieres.filter(estEvaluee);
  // Le bulletin annuel repose sur des notes synthétiques (une moyenne
  // annuelle par matière) : il n'y a plus de note de classe ni de
  // composition à détailler.
  const detail = periode !== PERIODE_ANNEE;

  const lignes = evaluees.map((mat) => {
    const notesMat = notesEleve.filter((n) => n.matiere === mat.nom);
    const coef = Number(mat.coefficient || 1);
    const moy = getSubjectAverage(notesMat, eleve.classe, niveau);
    const parts = detail && notesMat.length ? getSubjectParts(notesMat, eleve.classe, niveau) : null;
    return {
      mat: mat.nom,
      coef,
      moy,
      cours: parts?.cours ?? null,
      compo: parts?.composition ?? null,
      pts: moy != null ? moy * coef : null,
      rang: rangsParMatiere?.get(mat.nom)?.get(eleve._id) ?? null,
      moyClasse: matiereClasseAvg[mat.nom] ?? null,
      prof: professeurs?.get(mat.nom) || "",
      mention: moy != null ? getMention(moy, maxNote) : "",
    };
  });

  // Une matière sans note compte 0 à son coefficient, comme dans
  // getGeneralAverage : moyenne générale = total des points / total des coef.
  const totalCoef = lignes.reduce((s, l) => s + l.coef, 0);
  const totalPts = lignes.reduce((s, l) => s + (l.pts || 0), 0);
  const moyGene = notesEleve.length ? getGeneralAverage(notesEleve, evaluees, eleve.classe, niveau) : null;

  return {
    lignes,
    totalCoef,
    totalPts,
    totalMax: totalCoef * maxNote,
    moyGene,
    mention: getMention(moyGene, maxNote),
    distinction: getDistinction(moyGene, maxNote),
    numero: getNumeroBulletin(eleve, periode, schoolInfo, annee),
    avecDetail: lignes.some((l) => l.cours != null || l.compo != null),
    avecRang: lignes.some((l) => l.rang != null),
    avecProf: lignes.some((l) => l.prof),
    avecMoyClasse: lignes.some((l) => l.moyClasse != null),
  };
}
