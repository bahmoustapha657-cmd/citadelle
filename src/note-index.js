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

// Mémo pour les appelants qui passent le TABLEAU brut (calculs hors rendu :
// bulletins imprimés, promotion, analytique). L'index est mémoïsé sur
// l'IDENTITÉ du tableau : tous les appels d'un même jeu de données le
// partagent, et il se reconstruit tout seul au rechargement puisque le
// tableau est alors un nouvel objet. La WeakMap libère l'entrée avec lui.
const MEMO = new WeakMap();
function indexMemoise(notes) {
  let index = MEMO.get(notes);
  if (!index) {
    index = indexerNotesParEleve(notes);
    MEMO.set(notes, index);
  }
  return index;
}

// Accès sûr aux notes d'un élève. `source` accepte les DEUX formes :
//   • une Map déjà construite (usage React : indexerNotesParEleve dans un
//     useMemo, puis lecture à chaque ligne rendue) ;
//   • le tableau brut des notes, alors indexé et mémoïsé à la volée.
// Un élève sans note renvoie toujours le MÊME tableau vide gelé — pas de
// nouvelle allocation à chaque rendu, pas de mutation possible.
export function notesDeLEleve(source, eleveId, periode = null) {
  if (!source || !eleveId) return VIDE;
  const index = source instanceof Map ? source : indexMemoise(source);
  const liste = index.get(eleveId) || VIDE;
  // La liste d'un élève tient en quelques dizaines d'entrées : la filtrer par
  // période reste négligeable, inutile d'indexer plus finement.
  return periode ? liste.filter((n) => n.periode === periode) : liste;
}
