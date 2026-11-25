// ══════════════════════════════════════════════════════════════════════════
//  Rangement des notes après un changement de périodicité — logique pure
// ══════════════════════════════════════════════════════════════════════════
// Une note est « orpheline » quand sa période n'appartient plus à la
// périodicité de SA section : passé au semestre, le secondaire ne connaît plus
// T1/T2/T3, et ses notes trimestrielles disparaissent des grilles et des
// bulletins — alors que ces mêmes T1/T2/T3 restent valides au primaire.
//
// Tout se raisonne donc PAR GROUPE DE PÉRIODICITÉ, la détection comme
// l'écriture. L'ancienne version détectait par section mais appliquait le
// mapping à toutes les collections : renommer T2 → S1 pour le secondaire
// renommait aussi les T2, parfaitement valides, du primaire.
//
// Le rangement se fait À L'ENREGISTREMENT de la nouvelle périodicité, sans
// outil à part : les correspondances évidentes (T1 → S1, Novembre → T1) sont
// faites d'office, seule une période à cheval (T2 au passage au semestre)
// demande un choix. Il ne touche que l'année en cours : une année passée garde
// la périodicité de son temps (figée dans reglagesAnnees, cf. reglages-annee.js).
//
// Séparé de migration-periodes-data.js pour être testable sous Node.

import { TOUS_MOIS_COURTS } from "../../constants";
import { getPeriodesForSection, getSchoolPeriodiciteForSection } from "../../period-utils";

// Un groupe = un réglage de Paramètres → Périodicité scolaire. `sections` :
// valeurs de la colonne notes.section ; `collections` : les noms que
// l'adaptateur (data-supabase.js) résout vers ces sections.
export const GROUPES_PERIODICITE = [
  { groupe: "prescolaire", label: "Préscolaire", sections: ["prescolaire"], collections: ["notesPrescolaire"] },
  { groupe: "primaire", label: "Primaire", sections: ["primaire"], collections: ["notesPrimaire"] },
  { groupe: "secondaire", label: "Secondaire (collège + lycée)", sections: ["college", "lycee"], collections: ["notesCollege", "notesLycee"] },
];

const GROUPE_PAR_NOM = Object.fromEntries(GROUPES_PERIODICITE.map((g) => [g.groupe, g]));
const GROUPE_DE_SECTION = Object.fromEntries(
  GROUPES_PERIODICITE.flatMap(({ groupe, sections }) => sections.map((s) => [s, groupe])),
);

export const groupeDeSection = (section) => GROUPE_DE_SECTION[section] || null;

// Périodes valides de chaque groupe. Le préscolaire suit son propre réglage,
// à défaut celui du primaire (cf. getSchoolPeriodiciteForSection).
export function periodesParGroupe(schoolInfo, moisAnnee) {
  return Object.fromEntries(GROUPES_PERIODICITE.map(({ groupe }) => (
    [groupe, getPeriodesForSection(schoolInfo, groupe, moisAnnee)]
  )));
}

// Groupes dont la liste de périodes change entre deux réglages : la
// périodicité elle-même, ou le mois de début pour un groupe au mois (ses
// codes de mois glissent).
export function groupesARevoir(periodesAvant, periodesApres) {
  return GROUPES_PERIODICITE
    .map(({ groupe }) => groupe)
    .filter((g) => (periodesAvant?.[g] || []).join("|") !== (periodesApres?.[g] || []).join("|"));
}

// Clé d'une orpheline dans le mapping : la même période peut être orpheline
// dans deux groupes (T1 au secondaire ET en maternelle) et y recevoir deux
// destinations différentes.
export const cleOrpheline = ({ groupe, periode }) => `${groupe}/${periode}`;

// Ordre d'affichage : trimestres, semestres, puis les mois ; une période
// inconnue (saisie exotique) passe après, par ordre alphabétique.
const ORDRE_PERIODES = ["T1", "T2", "T3", "S1", "S2", ...TOUS_MOIS_COURTS];
const rangPeriode = (p) => {
  const i = ORDRE_PERIODES.indexOf(p);
  return i === -1 ? ORDRE_PERIODES.length : i;
};
const rangGroupe = (g) => GROUPES_PERIODICITE.findIndex((x) => x.groupe === g);

// Notes → périodes orphelines : [{ groupe, periode, count, annees }], triées
// par groupe puis par période. `annees` : les années scolaires concernées.
// Jamais orpheline : une note sans période, d'une section inconnue, ou d'un
// groupe dont on ignore la périodicité — faute de référence, on ne juge pas.
export function detecterPeriodesOrphelines(notes, periodes) {
  const orphelines = new Map();
  for (const note of notes || []) {
    const groupe = groupeDeSection(note?.section);
    const periode = note?.periode;
    const valides = periodes?.[groupe];
    if (!groupe || !periode || !valides?.length || valides.includes(periode)) continue;
    const cle = cleOrpheline({ groupe, periode });
    const o = orphelines.get(cle) || { groupe, periode, count: 0, annees: new Set() };
    o.count += 1;
    if (note.annee) o.annees.add(note.annee);
    orphelines.set(cle, o);
  }
  return [...orphelines.values()]
    .map((o) => ({ ...o, annees: [...o.annees].sort() }))
    .sort((a, b) => rangGroupe(a.groupe) - rangGroupe(b.groupe)
      || rangPeriode(a.periode) - rangPeriode(b.periode)
      || String(a.periode).localeCompare(String(b.periode)));
}

// ── Où va une ancienne période ──────────────────────────────────────────────
// L'année scolaire compte 9 mois (calcMoisAnnee). Chaque période en couvre une
// tranche, en mois depuis la rentrée : T1 = [0, 3), T2 = [3, 6), T3 = [6, 9) ;
// S1 = [0, 4,5), S2 = [4,5, 9) ; un mois = sa propre case. Une ancienne
// période va dans les nouvelles périodes qu'elle recouvre : une seule = rangement
// évident ; plusieurs (T2 au passage au semestre, le 5e mois aussi) = choix de
// la direction. Une période inconnue peut aller partout.
export function tranchePeriode(periode, moisAnnee) {
  const trimestre = /^T([1-3])$/.exec(periode || "");
  if (trimestre) {
    const debut = (Number(trimestre[1]) - 1) * 3;
    return [debut, debut + 3];
  }
  const semestre = /^S([12])$/.exec(periode || "");
  if (semestre) return semestre[1] === "1" ? [0, 4.5] : [4.5, 9];
  const mois = (moisAnnee || []).indexOf(periode);
  return mois === -1 ? null : [mois, mois + 1];
}

export function ciblesPossibles(periode, periodesValides, moisAnnee) {
  const valides = periodesValides || [];
  const source = tranchePeriode(periode, moisAnnee);
  if (!source) return [...valides];
  const recouvertes = valides.filter((p) => {
    const cible = tranchePeriode(p, moisAnnee);
    return cible && Math.min(source[1], cible[1]) - Math.max(source[0], cible[0]) > 0;
  });
  return recouvertes.length ? recouvertes : [...valides];
}

// Orphelines → propositions affichées : { ...orpheline, options, evidente }.
export function proposerRangement(orphelines, periodes, moisAnnee) {
  return (orphelines || []).map((o) => {
    const options = ciblesPossibles(o.periode, periodes?.[o.groupe], moisAnnee);
    return { ...o, options, evidente: options.length === 1 };
  });
}

// Choix de départ : les rangements évidents seulement. Une période à cheval
// reste sans réponse tant que la direction n'a pas tranché — jamais de
// destination devinée (l'ancien outil envoyait tout dans la 1re période :
// T1, T2 et T3 fusionnés dans S1 pour qui validait sans regarder).
export function choixParDefaut(propositions) {
  return Object.fromEntries((propositions || [])
    .filter((p) => p.evidente)
    .map((p) => [cleOrpheline(p), p.options[0]]));
}

export const rangementComplet = (propositions, choix) => (propositions || [])
  .every((p) => p.options.includes(choix?.[cleOrpheline(p)]));

// ── Années passées : elles gardent leur périodicité ─────────────────────────
// Une année passée sans réglages figés s'affiche avec ceux du jour : changer
// la périodicité rendrait invisibles ses notes. Plutôt que de les réécrire, on
// fige pour elle la périodicité d'AVANT le changement — celle de son temps.
// Seules les années antérieures à l'année en cours, qui ont des notes hors
// des nouvelles périodes, et rien de figé.
export function anneesAFiger(annees, anneeCourante, reglagesAnnees = {}) {
  return [...new Set(annees || [])]
    .filter((a) => a && anneeCourante && a < anneeCourante && !reglagesAnnees?.[a])
    .sort();
}

// Réglages figés complétés : la périodicité EFFECTIVE de chaque groupe (le
// préscolaire sans réglage propre suit le primaire — écrite en clair pour
// qu'un futur réglage de la maternelle ne s'applique pas à l'année passée).
// Renvoie undefined s'il n'y a rien à figer.
export function figerPeriodicite(schoolInfoAvant = {}, annees = [], maintenant = new Date()) {
  if (!annees.length) return undefined;
  const ecole = {
    periodicite: schoolInfoAvant.periodicite || "trimestre",
    periodicitePrescolaire: getSchoolPeriodiciteForSection(schoolInfoAvant, "prescolaire"),
    periodicitePrimaire: getSchoolPeriodiciteForSection(schoolInfoAvant, "primaire"),
    periodiciteSecondaire: getSchoolPeriodiciteForSection(schoolInfoAvant, "secondaire"),
  };
  const suite = { ...(schoolInfoAvant.reglagesAnnees || {}) };
  for (const annee of annees) {
    if (!suite[annee]) suite[annee] = { figesLe: maintenant.toISOString(), ecole };
  }
  return suite;
}

// ── Écritures ───────────────────────────────────────────────────────────────

// Choix validés → écritures, une par (groupe, période), limitées à `annee` :
// { groupe, periode, cible, collections, annee, attendu }, `attendu` valant le
// nombre de notes vues à l'analyse.
// Contrôlé contre la périodicité ACTUELLE — elle a pu changer depuis
// l'analyse : une période redevenue valide n'est plus à ranger (ses notes
// sont de nouveau visibles), et une destination hors du groupe fabriquerait
// de nouvelles orphelines. Dans les deux cas, refus : rien n'est écrit.
export function planifierMigration(orphelines, mapping, periodes, annee) {
  if (!annee) throw new Error("planifierMigration : annee manquante.");
  const operations = [];
  for (const o of orphelines) {
    const cible = mapping?.[cleOrpheline(o)];
    if (!cible) continue;
    const groupe = GROUPE_PAR_NOM[o.groupe];
    if (!groupe) throw new Error(`Groupe de périodicité inconnu : ${o.groupe}.`);
    const valides = periodes?.[o.groupe] || [];
    if (valides.includes(o.periode) || !valides.includes(cible)) {
      throw new Error(`La périodicité de ${groupe.label} a changé depuis l'analyse (${o.periode} → ${cible}) : fermez puis rouvrez l'outil.`);
    }
    operations.push({ groupe: o.groupe, periode: o.periode, cible, collections: groupe.collections, annee, attendu: o.count });
  }
  return operations;
}

// Résultats des écritures → bilan RÉEL. `issues[i]` : les résultats
// (Promise.allSettled) des écritures de operations[i], une par collection.
//   nonTraitees : notes vues à l'analyse mais laissées en place — la RLS
//                 ignore sans erreur les lignes qu'elle refuse, seul l'écart
//                 le trahit ;
//   erreurs     : écritures en échec (les autres ont pu aboutir).
export function bilanMigration(operations, issues) {
  const bilan = { totalMaj: 0, nonTraitees: 0, erreurs: [] };
  operations.forEach((op, i) => {
    const resultats = issues[i] || [];
    let faites = 0;
    for (const r of resultats) {
      if (r.status === "fulfilled") faites += r.value;
      else bilan.erreurs.push(`${op.periode} (${op.groupe}) : ${r.reason?.message || r.reason}`);
    }
    bilan.totalMaj += faites;
    // Une écriture en échec explique déjà l'écart : ne pas le compter deux fois.
    if (resultats.every((r) => r.status === "fulfilled")) bilan.nonTraitees += Math.max(0, op.attendu - faites);
  });
  return bilan;
}
