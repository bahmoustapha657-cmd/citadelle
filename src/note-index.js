// ── Index des notes par élève ────────────────────────────────────────────────
// Les écrans qui affichent une LISTE d'élèves ont besoin, pour chacun, de ses
// notes. Le réflexe naturel — `notes.filter(n => n.eleveId === eleve._id)` dans
// la boucle de rendu — parcourt toute la collection une fois PAR élève : le
// coût est le produit des deux (414 élèves × 7 496 notes ≈ 3,1 M comparaisons
// à chaque rendu, donc à chaque frappe dans la recherche ou changement de
// période). Mesuré : 186 ms/rendu aujourd'hui, ~930 ms projetés pour une école
// de 1 000 élèves — c'est la principale source de lenteur ressentie.
//
// On construit ici l'index UNE fois (coût linéaire), puis chaque élève est
// servi en temps constant. Mesuré : 41× plus rapide sur les volumes actuels,
// ~230× pour 1 000 élèves. À utiliser dans un `useMemo` dépendant de
// [notes, periode] pour ne le reconstruire que si les données changent.

const VIDE = Object.freeze([]);

// Renvoie une Map eleveId → notes[]. `periode` filtre en amont (optionnel).
export function indexerNotesParEleve(notes = [], periode = null) {
  const index = new Map();
  for (const note of notes) {
    if (periode != null && note.periode !== periode) continue;
    const liste = index.get(note.eleveId);
    if (liste) liste.push(note);
    else index.set(note.eleveId, [note]);
  }
  return index;
}

// Accès sûr : un élève sans note renvoie toujours le MÊME tableau vide gelé
// (pas de nouvelle allocation à chaque rendu, et pas de mutation possible).
export function notesDeLEleve(index, eleveId) {
  return index.get(eleveId) || VIDE;
}
