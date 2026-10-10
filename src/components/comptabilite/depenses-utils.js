// Dépenses par mois : regroupement sur la date saisie (AAAA-MM-JJ), pour
// filtrer l'onglet Dépenses et imprimer l'état d'un mois ou de toute l'année.
// Une dépense sans date valide n'appartient à aucun mois : elle ne sort que
// dans l'état global.

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// « 2026-10-14 » → « 2026-10 » ; "" si la date est absente ou mal formée.
export const moisDeDepense = (d) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(d?.date || ""));
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${m[1]}-${m[2]}` : "";
};

// « 2026-10 » → « Octobre 2026 ».
export const libelleMois = (cle) => {
  const [a, m] = String(cle || "").split("-");
  const nom = NOMS_MOIS[Number(m) - 1];
  return nom && a ? `${nom} ${a}` : "";
};

// Mois présents dans les dépenses, du plus ancien au plus récent.
export const moisDesDepenses = (depenses = []) =>
  [...new Set(depenses.map(moisDeDepense).filter(Boolean))].sort();

// `cle` vide : toutes les dépenses. Résultat trié par date (sans date à la fin).
export function filtrerDepensesParMois(depenses = [], cle = "") {
  const choisies = cle ? depenses.filter((d) => moisDeDepense(d) === cle) : [...depenses];
  return choisies.sort((a, b) => {
    const da = String(a.date || ""), db = String(b.date || "");
    if (!da || !db) return da ? -1 : db ? 1 : 0;
    return da.localeCompare(db);
  });
}

export const totalDepenses = (depenses = []) =>
  depenses.reduce((s, d) => s + (Number(d.montant) || 0), 0);

// [{ cle, total, nb }] dans l'ordre d'apparition — cle = cleDe(dépense).
export function regrouperDepenses(depenses = [], cleDe) {
  const groupes = new Map();
  for (const d of depenses) {
    const cle = cleDe(d);
    const g = groupes.get(cle) || { cle, total: 0, nb: 0 };
    g.total += Number(d.montant) || 0;
    g.nb += 1;
    groupes.set(cle, g);
  }
  return [...groupes.values()];
}
