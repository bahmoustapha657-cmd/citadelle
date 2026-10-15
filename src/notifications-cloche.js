// ── Cloche de l'en-tête : dernières actions du journal ──────────────────────
// La cloche liste les NB_NOTIFS dernières lignes de la table `historique`
// (le journal que remplit logActionDoc). La pastille compte celles saisies
// depuis la dernière ouverture de la cloche SUR CET APPAREIL (horodatage
// gardé dans localStorage, par école).
//
// Qui voit quoi : la RLS du module historique, inchangée. Un compte sans ce
// module lit 0 ligne, sans erreur, et la cloche reste vide.
//
// Pur (aucun import) : testable sous Node.

export const NB_NOTIFS = 10;

// `date` est un Date.now() ; une vieille ligne peut porter une date ISO.
export function horodatage(valeur) {
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : 0;
  const t = Date.parse(valeur ?? "");
  return Number.isNaN(t) ? 0 : t;
}

// items : lignes camelCase du journal (`_id`, `action`, `details`, `date`…).
// vuLe : horodatage de la dernière ouverture de la cloche.
export function preparerNotifs(items, vuLe = 0) {
  const liste = (items || [])
    .filter((i) => i && i.action)
    .map((i) => ({ ...i, id: i._id ?? i.id, date: horodatage(i.date) }))
    .sort((a, b) => b.date - a.date)
    .slice(0, NB_NOTIFS);
  const nonLues = liste.filter((n) => n.date > vuLe).length;
  return { liste, nonLues };
}

const cleVu = (schoolId) => `LC_notifVu_${schoolId}`;

// Première visite (rien de mémorisé) : on part de maintenant, sinon la
// pastille afficherait d'emblée les 10 dernières actions comme « non lues ».
export function lireVu(schoolId, stockage = globalThis.localStorage) {
  try {
    const v = Number(stockage?.getItem(cleVu(schoolId)));
    if (v > 0) return v;
    const maintenant = Date.now();
    stockage?.setItem(cleVu(schoolId), String(maintenant));
    return maintenant;
  } catch {
    return Date.now();
  }
}

export function ecrireVu(schoolId, quand = Date.now(), stockage = globalThis.localStorage) {
  try { stockage?.setItem(cleVu(schoolId), String(quand)); } catch { /* navigation privée */ }
}
