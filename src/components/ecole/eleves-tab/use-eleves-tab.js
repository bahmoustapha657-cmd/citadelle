// Logique de l'onglet Élèves : droit d'ouvrir la modale « Compte parent »
// d'un élève (comptes qui le suivent, rattachement, création —
// ParentCompteModale / use-parent-compte.js).
export function useElevesTab({ canEdit, canCreateParent, setParentEleve }) {
  // Compat : si l'appelant ne fournit pas canCreateParent, on retombe sur
  // canEdit (le comportement précédent : direction/admin uniquement).
  const peutCreerParent = canCreateParent ?? canEdit;
  const ouvrirCompte = (e) => setParentEleve(e);
  return { peutCreerParent, ouvrirCompte };
}
