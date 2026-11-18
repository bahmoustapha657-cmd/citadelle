// Page à ouvrir juste après un changement d'espace : « Toutes mes classes »
// ouvre une classe d'un AUTRE établissement de l'enseignant, ce qui change
// d'espace puis recharge l'app — on retient où aller, et App y va dès que le
// module existe dans le nouvel espace. Retenue 2 minutes au plus : un
// changement d'espace raté ne doit pas détourner une ouverture ultérieure.
const CLE = "lc-destination-espace";
const DUREE_MS = 2 * 60 * 1000;

const session = () => {
  try { return globalThis.sessionStorage || null; } catch { return null; }
};

export function retenirDestination(page, { stockage = session(), maintenant = Date.now() } = {}) {
  try { stockage?.setItem(CLE, JSON.stringify({ page, le: maintenant })); } catch { /* stockage refusé */ }
}

// Page retenue si elle fait partie de `pagesPossibles` (elle est alors
// oubliée) ; null sinon. Périmée : oubliée sans être rendue.
export function prendreDestination(pagesPossibles = [], { stockage = session(), maintenant = Date.now() } = {}) {
  let d = null;
  try { d = JSON.parse(stockage?.getItem(CLE) || "null"); } catch { d = null; }
  if (!d) return null;
  const oublier = () => { try { stockage?.removeItem(CLE); } catch { /* stockage refusé */ } };
  if (!d.page || !(maintenant - Number(d.le) <= DUREE_MS)) { oublier(); return null; }
  if (!pagesPossibles.includes(d.page)) return null;
  oublier();
  return d.page;
}
