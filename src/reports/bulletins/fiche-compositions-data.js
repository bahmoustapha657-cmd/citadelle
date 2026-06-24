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
// `matieresForClasse` (optionnel) : fn classe → matières de la classe. Quand
// elle est fournie, SEULES les matières prises en charge par la classe de
// l'élève comptent dans la moyenne (dénominateur) — les autres colonnes
// affichent « — » et ne sont pas comptées. Sans elle, toutes les matières
// passées comptent (rétrocompat).
// Retourne { resultats, stats } ; resultats trié par moyenne décroissante.
export function computeFicheResultats({ classe, periode, notes, matieres, eleves, maxNote = 20, matieresForClasse = null }) {
  const mi = maxNote / 2;
  const elevesClasse = classe === "all" ? eleves : eleves.filter((e) => e.classe === classe);

  const resultats = elevesClasse.map((e) => {
    // Repli sur la liste globale si la classe n'a aucune matière dédiée : un
    // tableau vide (mais « truthy ») vidait classSet → moyGene null → l'élève
    // disparaissait du classement et toutes ses notes étaient ignorées.
    const matsClasse = matieresForClasse ? matieresForClasse(e.classe) : null;
    const matsEleve = (matsClasse && matsClasse.length) ? matsClasse : matieres;
    const classSet = new Set(matsEleve.map((m) => m.nom));
    const ne = notes.filter((n) => n.eleveId === e._id && n.periode === periode && n.type === "Composition");
    let tot = 0, totC = 0;
    const notesMat = matieres.map((mat) => {
      const dansClasse = classSet.has(mat.nom);
      const coef = mat.coefficient || 1;
      if (!dansClasse) return { nom: mat.nom, coef, moy: null }; // matière hors classe : ignorée
      const nm = ne.filter((n) => n.matiere === mat.nom);
      const moy = nm.length ? nm.reduce((s, n) => s + Number(n.note), 0) / nm.length : null;
      totC += coef; // SEULES les matières de la classe comptent au dénominateur
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
