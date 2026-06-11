// Détermination dynamique de la classe suivante (système guinéen).
// Remplace l'ancienne table figée PROMOTION_SUIVANTE, qui ne correspondait
// pas aux noms réels des classes : elle ignorait les accents (« 1ere Annee »
// vs « 1ère Année »), utilisait le système français (6eme→5eme→4eme) au lieu
// du guinéen (7ème→10ème Année), et ne gérait ni le passage primaire→collège
// ni les classes personnalisées suffixées.
//
// Cursus couvert :
//   Maternelle X → 1ère Année X → … → 6ème Année X → 7ème Année X (collège)
//   → … → 10ème Année X → 11ème Année X (lycée) → 12ème Année X
//   → Terminale X → fin de cycle.
//
// Contrat de retour :
//   chaîne     → classe suivante
//   null       → fin de cycle (Terminale)
//   undefined  → nom de classe non reconnu (aucune écriture, signalé au bilan)

const RE_TERMINALE = /^\s*terminale\b/i;
const RE_MATERNELLE = /^\s*maternelle\s*(.*)$/i;
// « 1ère Année A », « 7ème Année B », tolère l'ASCII legacy (« 1ere Annee A »)
// et l'absence d'ordinal (« 3 Année »).
const RE_ANNEE = /^\s*(\d+)\s*(?:ère|ere|ème|eme|e)?\s*ann[ée]e\s*(.*)$/i;

const ordinal = (n) => (n === 1 ? "1ère" : `${n}ème`);
const avecSuffixe = (base, suffixe) => {
  const s = (suffixe || "").trim();
  return s ? `${base} ${s}` : base;
};

export function classeSuivante(classe) {
  const c = String(classe || "").trim();
  if (!c) return undefined;

  if (RE_TERMINALE.test(c)) return null;

  const mat = c.match(RE_MATERNELLE);
  if (mat) return avecSuffixe("1ère Année", mat[1]);

  const annee = c.match(RE_ANNEE);
  if (annee) {
    const n = Number(annee[1]);
    if (!Number.isFinite(n) || n < 1 || n > 12) return undefined;
    if (n >= 12) return avecSuffixe("Terminale", annee[2]);
    return avecSuffixe(`${ordinal(n + 1)} Année`, annee[2]);
  }

  return undefined;
}
