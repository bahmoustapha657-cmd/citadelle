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

import { getNiveauxExamen } from "./constants";

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

// Après la Grande Section, l'élève entre au primaire — dont le premier niveau
// dépend du système de l'école : « CP » en francophone, « 1ère Année » en
// guinéen. Depuis que le préscolaire est une section à part (2026-07), ces
// trois niveaux servent dans LES DEUX systèmes : sans cette distinction, une
// école guinéenne aurait vu ses grandes sections promues en « CP ».
const SECTION_MAT_SUIVANTE = { petite: "Moyenne Section", moyenne: "Grande Section" };
const APRES_GRANDE_SECTION = { guineen: "1ère Année", francophone: "CP" };
const COLLEGE_FR_SUIVANT = { 6: "5ème", 5: "4ème", 4: "3ème", 3: "Seconde" };

const ordinal = (n) => (n === 1 ? "1ère" : `${n}ème`);
const avecSuffixe = (base, suffixe) => {
  const s = (suffixe || "").trim();
  return s ? `${base} ${s}` : base;
};

// `systeme` (« guineen » par défaut, comme getSystemeScolaire) ne sert
// aujourd'hui qu'à la sortie de Grande Section — le reste des cursus est
// reconnu par motif, indépendamment du réglage de l'école.
export function classeSuivante(classe, systeme = "guineen") {
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

  // ── Préscolaire (les deux systèmes) puis francophone ──
  const sectionMat = c.match(RE_SECTION_MAT);
  if (sectionMat) {
    const niveau = sectionMat[1].toLowerCase();
    const suivante = SECTION_MAT_SUIVANTE[niveau]
      || APRES_GRANDE_SECTION[systeme] || APRES_GRANDE_SECTION.guineen;
    return avecSuffixe(suivante, sectionMat[2]);
  }

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

// ── Classes d'examen ────────────────────────────────────────────────────────
// Le passage de ces classes se joue devant un JURY NATIONAL (CEE, BEPC, BAC),
// pas sur nos évaluations : la promotion automatique n'a pas à en décider.
// Sans cette garde, un élève à 12/20 recalé au CEE partait quand même en
// 7ème Année, et un élève à 9/20 reçu restait en 6ème.
//
// La Terminale était déjà épargnée, mais par accident : elle n'a pas de classe
// suivante. La 6ème et la 10ème Année, elles, en ont une — d'où le traitement
// ordinaire dont elles faisaient l'objet.
//
// Les niveaux concernés sont DÉDUITS des listes de l'école (dernier niveau de
// chaque cycle) : 6ème Année / 10ème Année / Terminale en guinéen, CM2 / 3ème
// / Terminale en francophone. Un nouveau système hérite de la règle sans rien
// ajouter ici.
export function estClasseExamen(classe, systeme = "guineen") {
  const c = String(classe || "").trim().toLowerCase();
  if (!c) return false;
  return getNiveauxExamen(systeme).some((niveau) => {
    const n = String(niveau).trim().toLowerCase();
    // « 6ème Année » doit matcher « 6ème Année A » mais PAS « 16ème Année ».
    return c === n || c.startsWith(`${n} `);
  });
}
