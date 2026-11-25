// Accès aux données du rangement des notes — Supabase, via l'adaptateur.
// La logique (qu'est-ce qu'une orpheline, où elle va, quelles écritures) vit
// dans migration-periodes-utils.js ; ce fichier ne porte que lectures et
// écritures.
import { chargerCollection, modifierDocsParFiltre } from "../../backend/data-supabase";
import {
  GROUPES_PERIODICITE, bilanMigration, detecterPeriodesOrphelines, planifierMigration,
} from "./migration-periodes-utils";

// Notes des `groupes` HORS des périodes valides (`saufPeriodes`, appliqué par
// PostgREST en ligne comme par le miroir PowerSync) : rien à ranger = lectures
// vides. L'année en cours seulement, ou toutes avec `toutesAnnees` (pour
// savoir quelles années passées figer à l'ancienne périodicité).
// Renvoie { orphelines (de `anneeCourante`), annees (toutes celles vues) }.
export async function analyserRangement(schoolId, { groupes, periodes, anneeCourante, toutesAnnees = false }) {
  const cibles = GROUPES_PERIODICITE.filter((g) => groupes.includes(g.groupe));
  const lectures = await Promise.all(cibles.flatMap(({ groupe, collections }) => (
    collections.map((nom) => chargerCollection(schoolId, nom, {
      saufPeriodes: periodes[groupe],
      ...(toutesAnnees ? {} : { annee: anneeCourante }),
    }))
  )));
  // Une lecture en échec n'est pas « rien à ranger » : l'annoncer ainsi ferait
  // croire à la direction que tout est en ordre.
  const echec = lectures.find((r) => r.erreur || r.unsupported);
  if (echec) throw new Error(echec.erreur || "Notes indisponibles.");
  const notes = lectures.flatMap((r) => r.items);
  return {
    orphelines: detecterPeriodesOrphelines(notes.filter((n) => n.annee === anneeCourante), periodes),
    annees: [...new Set(notes.map((n) => n.annee).filter(Boolean))],
  };
}

// Applique les choix validés, pour `annee` seulement : UNE écriture par
// (collection, période) au lieu d'une par note — une requête PostgREST, ou une
// instruction SQL sur le miroir PowerSync, qui remonte ensuite les lignes à
// Supabase à son rythme. Les écritures partent ensemble : elles visent des
// lignes disjointes, une période orpheline n'étant jamais la destination
// d'une autre. Renvoie le bilan réel { totalMaj, nonTraitees, erreurs }.
export async function appliquerMapping(schoolId, orphelines, mapping, periodes, annee) {
  const operations = planifierMigration(orphelines, mapping, periodes, annee);
  const issues = await Promise.all(operations.map((op) => Promise.allSettled(op.collections.map((nom) => (
    modifierDocsParFiltre(schoolId, nom, { periode: op.periode, annee: op.annee }, { periode: op.cible })
  )))));
  return bilanMigration(operations, issues);
}
