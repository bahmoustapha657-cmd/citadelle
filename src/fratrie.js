// ── Fratrie d'un élève : les enfants d'un même tuteur ──────────────────────
// Module PUR (testé par tests/fratrie.test.js), utilisé par le reçu famille
// des mensualités. La règle est celle des comptes parents (memeParent) : même
// nom de tuteur, puis même numéro — ou, faute de numéro, même filiation. Un
// homonyme sans numéro ni filiation commune n'est donc jamais rattaché.
import { memeParent, nomComparable } from "./comptes-parents.js";

// Index des élèves par nom de tuteur : la grille compte des centaines de
// lignes, comparer chacune à toutes les autres à chaque rendu serait coûteux.
// Renvoie fratrieDe(eleve) → [eleve, ...frères et sœurs] (l'élève d'abord,
// puis par classe et nom), sans doublon d'identifiant.
export function indexFratries(eleves = []) {
  const parNom = new Map();
  for (const e of eleves) {
    const nom = nomComparable(e?.tuteur);
    if (!nom) continue;
    parNom.set(nom, [...(parNom.get(nom) || []), e]);
  }
  return (eleve) => {
    if (!eleve) return [];
    const autres = (parNom.get(nomComparable(eleve.tuteur)) || [])
      .filter((x) => x._id !== eleve._id && memeParent(eleve, x));
    const vus = new Set([eleve._id]);
    const uniques = autres.filter((x) => (vus.has(x._id) ? false : (vus.add(x._id), true)));
    uniques.sort((a, b) => String(a.classe || "").localeCompare(String(b.classe || ""), "fr", { numeric: true })
      || `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"));
    return [eleve, ...uniques];
  };
}
