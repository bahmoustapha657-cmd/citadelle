// Accès aux données de la migration des périodes — Supabase, via l'adaptateur.
// Liquidation Firebase : l'ancien chemin Firestore (getDocs/writeBatch) ne
// voyait plus AUCUNE note depuis la bascule de la prod sur Supabase ; l'outil
// annonçait « aucune note orpheline » et ne migrait rien.
// La logique (qu'est-ce qu'une orpheline, quelles écritures) vit dans
// migration-periodes-utils.js ; ce fichier ne porte que lectures et écritures.
import { chargerCollection, modifierDocsParFiltre, supprimerDocsParFiltre } from "../../backend/data-supabase";
import {
  GROUPES_PERIODICITE, SUPPRIMER, bilanMigration, detecterPeriodesOrphelines, planifierMigration,
} from "./migration-periodes-utils";

// Scanne les notes de TOUTES les années : la vue archive les affiche avec la
// périodicité actuelle, une année close y est donc tout aussi invisible.
// Seules les notes HORS périodicité sont lues (`saufPeriodes`, appliqué par
// PostgREST en ligne comme par le miroir PowerSync — la prod) : rien à migrer
// = quatre lectures vides. detecterPeriodesOrphelines reste seul juge.
export async function collecterPeriodesOrphelines(schoolId, periodes) {
  const lectures = await Promise.all(GROUPES_PERIODICITE.flatMap(({ groupe, collections }) => (
    collections.map((nom) => chargerCollection(schoolId, nom, { saufPeriodes: periodes[groupe] }))
  )));
  // Une lecture en échec n'est pas « zéro orpheline » : l'annoncer ainsi
  // ferait croire à la direction que tout est en ordre.
  const echec = lectures.find((r) => r.erreur || r.unsupported);
  if (echec) throw new Error(echec.erreur || "Notes indisponibles.");
  return detecterPeriodesOrphelines(lectures.flatMap((r) => r.items), periodes);
}

// Applique le mapping validé : UNE écriture par (collection, période) au lieu
// d'une par note — une requête PostgREST, ou une instruction SQL sur le miroir
// PowerSync, qui remonte ensuite les lignes à Supabase à son rythme. Les
// écritures partent ensemble : elles visent des lignes disjointes, une période
// orpheline n'étant jamais la destination d'une autre.
// Renvoie le bilan réel { totalMaj, totalSup, nonTraitees, erreurs }.
export async function appliquerMapping(schoolId, orphelines, mapping, periodes) {
  const operations = planifierMigration(orphelines, mapping, periodes);
  const issues = await Promise.all(operations.map((op) => Promise.allSettled(op.collections.map((nom) => (
    op.cible === SUPPRIMER
      ? supprimerDocsParFiltre(schoolId, nom, { periode: op.periode })
      : modifierDocsParFiltre(schoolId, nom, { periode: op.periode }, { periode: op.cible })
  )))));
  return bilanMigration(operations, issues);
}
