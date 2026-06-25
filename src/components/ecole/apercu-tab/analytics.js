// Calculs purs du tableau de bord analytique (direction). Aucune dépendance
// réseau/UI : prend les données déjà chargées par l'école et produit les jeux
// de données des graphiques. Cohérent avec les bulletins (mêmes moyennes via
// getGeneralAverage / getSubjectAverage et SEULES les matières de la classe).
import { getGeneralAverage, getSubjectAverage } from "../../../note-utils";

// Moyenne générale d'un élève pour une période donnée (toutes périodes si vide).
// Un élève SANS aucune note sur la période n'est pas « évalué » (renvoie null) :
// sinon getGeneralAverage renverrait 0 (dénominateur = liste des matières) et
// gonflerait l'effectif évalué en plombant moyenne et taux de réussite.
function moyenneEleve(eleve, notes, matieresForClasse, periode) {
  const notesE = notes.filter((n) => n.eleveId === eleve._id && (!periode || n.periode === periode));
  if (notesE.length === 0) return null;
  return getGeneralAverage(notesE, matieresForClasse(eleve.classe), eleve.classe);
}

// Statistiques agrégées d'un groupe d'élèves : effectif, nombre évalué,
// moyenne du groupe, admis (moyenne ≥ seuil) et taux de réussite (%).
export function statsGroupe(eleves, notes, matieresForClasse, periode, seuil) {
  const moys = eleves
    .map((e) => moyenneEleve(e, notes, matieresForClasse, periode))
    .filter((m) => m !== null);
  const evalues = moys.length;
  const moyenne = evalues ? moys.reduce((s, m) => s + m, 0) / evalues : null;
  const admis = moys.filter((m) => m >= seuil).length;
  const taux = evalues ? (admis / evalues) * 100 : 0;
  return { effectif: eleves.length, evalues, moyenne, admis, taux };
}

// Stats par classe (pour les histogrammes taux de réussite / moyenne).
export function statsParClasse(classes, eleves, notes, matieresForClasse, periode, seuil) {
  return classes.map((c) => ({
    classe: c.nom,
    ...statsGroupe(eleves.filter((e) => e.classe === c.nom), notes, matieresForClasse, periode, seuil),
  }));
}

// Moyenne par matière sur tout l'établissement : pour chaque élève on calcule
// sa moyenne dans chaque matière de SA classe (getSubjectAverage), puis on
// moyenne entre élèves. Trié décroissant (les dernières = matières en
// difficulté). `eleves` : nombre d'élèves comptés par matière.
export function moyenneParMatiere(eleves, notes, matieresForClasse, periode) {
  const acc = new Map(); // nom -> { somme, n }
  eleves.forEach((e) => {
    const mats = matieresForClasse(e.classe);
    const notesE = notes.filter((n) => n.eleveId === e._id && (!periode || n.periode === periode));
    mats.forEach((mat) => {
      const moy = getSubjectAverage(notesE.filter((n) => n.matiere === mat.nom), e.classe);
      if (moy == null) return;
      const cur = acc.get(mat.nom) || { somme: 0, n: 0 };
      cur.somme += moy;
      cur.n += 1;
      acc.set(mat.nom, cur);
    });
  });
  return [...acc.entries()]
    .map(([matiere, a]) => ({ matiere, moyenne: a.somme / a.n, eleves: a.n }))
    .sort((x, y) => y.moyenne - x.moyenne);
}

// Évolution de la moyenne école et du taux de réussite, période par période.
export function evolutionMoyenne(eleves, notes, matieresForClasse, periodes, seuil) {
  return periodes.map((p) => {
    const st = statsGroupe(eleves, notes, matieresForClasse, p, seuil);
    return { periode: p, moyenne: st.moyenne, taux: st.taux, evalues: st.evalues };
  });
}

// Comparaison filles / garçons pour une période (le champ `sexe` vaut M ou F).
export function statsGenre(eleves, notes, matieresForClasse, periode, seuil) {
  const init = (s) => String(s || "").trim().toUpperCase();
  return {
    filles: statsGroupe(eleves.filter((e) => init(e.sexe).startsWith("F")), notes, matieresForClasse, periode, seuil),
    garcons: statsGroupe(eleves.filter((e) => init(e.sexe).startsWith("M")), notes, matieresForClasse, periode, seuil),
  };
}
