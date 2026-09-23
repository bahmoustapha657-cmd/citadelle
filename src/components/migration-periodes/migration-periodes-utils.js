// ══════════════════════════════════════════════════════════════════════════
//  Migration des périodes orphelines — logique pure (aucun accès aux données)
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
// Séparé de migration-periodes-data.js pour être testable sous Node.

import { TOUS_MOIS_COURTS } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";

// Destination « supprimer ces notes » dans le mapping (select du modal).
export const SUPPRIMER = "_delete_";

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
// par groupe puis par période. `annees` : les années scolaires concernées —
// la migration les touche toutes.
// Jamais orpheline : une note sans période, d'une section inconnue, ou d'un
// groupe dont on ignore la périodicité — faute de référence, on ne juge pas
// (et on ne propose surtout pas de la supprimer).
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

// Destination proposée d'office : la première période du groupe, comme
// avant. Rien n'est écrit sans validation explicite.
export function mappingParDefaut(orphelines, periodes) {
  return Object.fromEntries(orphelines.map((o) => [cleOrpheline(o), periodes?.[o.groupe]?.[0] ?? SUPPRIMER]));
}

// Mapping validé → écritures, une par (groupe, période) :
// { groupe, periode, cible, collections, attendu }, `cible` valant SUPPRIMER
// pour une suppression et `attendu` le nombre de notes vues au scan.
// Contrôlé contre la périodicité ACTUELLE — elle a pu changer depuis le scan,
// modal ouvert : une période redevenue valide n'est plus à migrer (ses notes
// sont de nouveau visibles), et une destination hors du groupe fabriquerait
// de nouvelles orphelines. Dans les deux cas, refus : rien n'est écrit.
export function planifierMigration(orphelines, mapping, periodes) {
  const operations = [];
  for (const o of orphelines) {
    const cible = mapping?.[cleOrpheline(o)];
    if (!cible) continue;
    const groupe = GROUPE_PAR_NOM[o.groupe];
    if (!groupe) throw new Error(`Groupe de périodicité inconnu : ${o.groupe}.`);
    const valides = periodes?.[o.groupe] || [];
    if (valides.includes(o.periode) || (cible !== SUPPRIMER && !valides.includes(cible))) {
      throw new Error(`La périodicité de ${groupe.label} a changé depuis l'analyse (${o.periode} → ${cible}) : fermez puis rouvrez l'outil.`);
    }
    operations.push({ groupe: o.groupe, periode: o.periode, cible, collections: groupe.collections, attendu: o.count });
  }
  return operations;
}

// Résultats des écritures → bilan RÉEL. `issues[i]` : les résultats
// (Promise.allSettled) des écritures de operations[i], une par collection.
//   nonTraitees : notes vues au scan mais laissées en place — la RLS ignore
//                 sans erreur les lignes qu'elle refuse, seul l'écart le trahit ;
//   erreurs     : écritures en échec (les autres ont pu aboutir).
export function bilanMigration(operations, issues) {
  const bilan = { totalMaj: 0, totalSup: 0, nonTraitees: 0, erreurs: [] };
  operations.forEach((op, i) => {
    const resultats = issues[i] || [];
    let faites = 0;
    for (const r of resultats) {
      if (r.status === "fulfilled") faites += r.value;
      else bilan.erreurs.push(`${op.periode} (${op.groupe}) : ${r.reason?.message || r.reason}`);
    }
    if (op.cible === SUPPRIMER) bilan.totalSup += faites;
    else bilan.totalMaj += faites;
    // Une écriture en échec explique déjà l'écart : ne pas le compter deux fois.
    if (resultats.every((r) => r.status === "fulfilled")) bilan.nonTraitees += Math.max(0, op.attendu - faites);
  });
  return bilan;
}
