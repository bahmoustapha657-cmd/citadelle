// Calculs purs de la fiche de compositions : classement des élèves par
// moyenne de composition + statistiques récapitulatives de la classe.

// Mention/appréciation à partir d'une moyenne et de la note max.
export const apprecComposition = (v, maxNote) => {
  const n = Number(v);
  return n >= (maxNote * 0.8) ? "Très Bien"
    : n >= (maxNote * 0.7) ? "Bien"
      : n >= (maxNote * 0.6) ? "Assez Bien"
        : n >= (maxNote / 2) ? "Passable"
          : "Insuffisant";
};

// Classement et statistiques de la classe pour une période donnée.
// Retourne { resultats, stats } ; resultats trié par moyenne décroissante.
export function computeFicheResultats({ classe, periode, notes, matieres, eleves, maxNote = 20 }) {
  const mi = maxNote / 2;
  const elevesClasse = classe === "all" ? eleves : eleves.filter((e) => e.classe === classe);

  const resultats = elevesClasse.map((e) => {
    const ne = notes.filter((n) => n.eleveId === e._id && n.periode === periode && n.type === "Composition");
    let tot = 0, totC = 0;
    const notesMat = matieres.map((mat) => {
      const nm = ne.filter((n) => n.matiere === mat.nom);
      const moy = nm.length ? nm.reduce((s, n) => s + Number(n.note), 0) / nm.length : null;
      const coef = mat.coefficient || 1;
      totC += coef; // toutes les matières comptent au dénominateur
      if (moy !== null) { tot += moy * coef; }
      return { nom: mat.nom, coef, moy };
    });
    const moyGene = totC > 0 ? tot / totC : null;
    return { eleve: e, notesMat, moyGene };
  }).filter((r) => r.moyGene !== null).sort((a, b) => b.moyGene - a.moyGene);

  if (resultats.length === 0) return { resultats, stats: null };

  const nb = resultats.length;
  const dist = { "Très Bien": 0, "Bien": 0, "Assez Bien": 0, "Passable": 0, "Insuffisant": 0 };
  resultats.forEach((r) => { dist[apprecComposition(r.moyGene.toFixed(2), maxNote)]++; });

  const stats = {
    nb,
    moyClasse: resultats.reduce((s, r) => s + r.moyGene, 0) / nb,
    plus_haute: Math.max(...resultats.map((r) => r.moyGene)),
    plus_basse: Math.min(...resultats.map((r) => r.moyGene)),
    admis: resultats.filter((r) => r.moyGene >= mi).length,
    dist,
  };
  return { resultats, stats };
}
