// Détermination dynamique de la classe suivante (système guinéen).
// Remplace l'ancienne table figée PROMOTION_SUIVANTE, qui ne correspondait
// pas aux noms réels des classes : elle ignorait les accents (« 1ere Annee »
// vs « 1ère Année »), utilisait le système français (6eme→5eme→4eme) au lieu
// du guinéen (7ème→10ème Année), et ne gérait ni le passage primaire→collège
// ni les classes personnalisées suffixées.
//
// Cursus couverts (les deux nomenclatures, indépendamment du réglage école) :
//   Guinéen : Maternelle X → 1ère Année X → … → 6ème Année X
//     → 7ème Année X (collège) → … → 10ème → 11ème (lycée) → 12ème
//     → Terminale X → fin de cycle.
//   Francophone : Petite Section X → Moyenne → Grande → CP → CE1 → CE2
//     → CM1 → CM2 → 6ème X (collège) → 5ème → 4ème → 3ème
//     → Seconde X (lycée) → Première → Terminale X → fin de cycle.
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
// Francophone — l'ordre des tests garantit que « Nème Année » (guinéen)
// est résolu AVANT ces motifs, donc « 1ère » seule = Première (lycée).
const RE_SECTION_MAT = /^\s*(petite|moyenne|grande)\s+section\s*(.*)$/i;
const RE_CP = /^\s*cp\s*(.*)$/i;
const RE_CE_CM = /^\s*(ce|cm)\s*([12])\s*(.*)$/i;
const RE_SECONDE = /^\s*(?:seconde|2nde)\s*(.*)$/i;
const RE_PREMIERE = /^\s*(?:premi[èe]re|1\s*[èe]re)\s*(.*)$/i;
const RE_COLLEGE_FR = /^\s*([3-6])\s*(?:ème|eme|e)\s*(.*)$/i;

const SECTION_MAT_SUIVANTE = { petite: "Moyenne Section", moyenne: "Grande Section", grande: "CP" };
const COLLEGE_FR_SUIVANT = { 6: "5ème", 5: "4ème", 4: "3ème", 3: "Seconde" };

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

  // ── Système francophone ──
  const sectionMat = c.match(RE_SECTION_MAT);
  if (sectionMat) return avecSuffixe(SECTION_MAT_SUIVANTE[sectionMat[1].toLowerCase()], sectionMat[2]);

  const cp = c.match(RE_CP);
  if (cp) return avecSuffixe("CE1", cp[1]);

  const ceCm = c.match(RE_CE_CM);
  if (ceCm) {
    const cycle = ceCm[1].toLowerCase();
    const n = Number(ceCm[2]);
    if (cycle === "ce") return avecSuffixe(n === 1 ? "CE2" : "CM1", ceCm[3]);
    return avecSuffixe(n === 1 ? "CM2" : "6ème", ceCm[3]);
  }

  const seconde = c.match(RE_SECONDE);
  if (seconde) return avecSuffixe("Première", seconde[1]);

  const premiere = c.match(RE_PREMIERE);
  if (premiere) return avecSuffixe("Terminale", premiere[1]);

  const collegeFr = c.match(RE_COLLEGE_FR);
  if (collegeFr) return avecSuffixe(COLLEGE_FR_SUIVANT[Number(collegeFr[1])], collegeFr[2]);

  return undefined;
}
