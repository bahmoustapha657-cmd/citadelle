// Onglet « 👥 Comptes » de Comptes & Postes (logique pure, testable sans
// React). La table mêle le personnel, les enseignants et les parents — des
// centaines de lignes dans une grande école : sans filtre, le compte du
// comptable se perdait au milieu des parents.

// Libellés traduits : comptesPostes.comptes.types.*
export const TYPES_COMPTE = ["personnel", "enseignant", "parent"];

// Tout ce qui n'est ni enseignant ni parent est du personnel : direction,
// comptable, surveillant, chefs de section et postes créés par l'école.
export const typeCompte = (compte) => (compte?.role === "enseignant" ? "enseignant"
  : compte?.role === "parent" ? "parent" : "personnel");

const normaliser = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Nom, identifiant, e-mail ou intitulé du poste ; sans accents ni casse, et
// sans espaces pour un numéro tapé « 622 55 50 01 » ou « 622555001 ».
function correspond(compte, recherche) {
  const q = normaliser(recherche).trim();
  if (!q) return true;
  const texte = [compte.nom, compte.login, compte.email, compte.label].map(normaliser).join(" | ");
  return texte.includes(q) || texte.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""));
}

export function compterParType(comptes = []) {
  const n = { tous: comptes.length, personnel: 0, enseignant: 0, parent: 0 };
  for (const c of comptes) n[typeCompte(c)] += 1;
  return n;
}

export function filtrerComptes(comptes = [], { type = "tous", recherche = "" } = {}) {
  return comptes.filter((c) => (type === "tous" || typeCompte(c) === type) && correspond(c, recherche));
}
