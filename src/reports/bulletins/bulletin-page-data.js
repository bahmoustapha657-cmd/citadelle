// Calculs purs d'un bulletin individuel : moyennes par matière, moyenne
// générale, mention et numéro. Aucune dépendance au DOM.
import { getGeneralAverage, getSubjectAverage } from "../../note-utils.js";
import { getMention, getMentionColors, getNumeroBulletin } from "./bulletin-format.js";

// Renvoie le modèle exploité par le gabarit :
//  - lignes : { mat, coef, moy, moyClasse } par matière
//  - totalCoef, moyGene, mention, ms (couleurs), numero
export function computeBulletinModel({ eleve, notes, matieres, periode, niveau, maxNote, schoolInfo, annee, matiereClasseAvg = {} }) {
  const notesEleve = notes.filter((n) => n.eleveId === eleve._id && n.periode === periode);
  const lignes = matieres.map((mat) => {
    const noteMat = notesEleve.filter((n) => n.matiere === mat.nom);
    const moyenneMatiere = getSubjectAverage(noteMat, eleve.classe, niveau);
    const moy = moyenneMatiere != null ? moyenneMatiere.toFixed(2) : "—";
    return { mat: mat.nom, coef: mat.coefficient || 1, moy, moyClasse: matiereClasseAvg[mat.nom] };
  });
  const totalCoef = matieres.reduce((s, mat) => s + Number(mat.coefficient || 1), 0);
  const moyenneGenerale = getGeneralAverage(notesEleve, matieres, eleve.classe, niveau);
  const moyGene = moyenneGenerale != null ? moyenneGenerale.toFixed(2) : "—";
  const mention = getMention(moyGene, maxNote);
  const ms = getMentionColors(mention);
  const numero = getNumeroBulletin(eleve, periode, schoolInfo, annee);

  return { lignes, totalCoef, moyGene, mention, ms, numero };
}
