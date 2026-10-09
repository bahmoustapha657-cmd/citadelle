// Envoi d'UNE opération de la file PowerSync vers Supabase (extrait de
// connector.js pour être testable sans navigateur ni @powersync/web).
//
// Modification et suppression demandent le NOMBRE de lignes touchées : la
// RLS ignore sans erreur la ligne qu'elle refuse, et une fiche supprimée
// entre-temps sur un autre appareil donne le même 0. Sans ce contrôle, le
// refus passait pour un succès et la saisie hors ligne disparaissait en
// silence à la synchro suivante (cf. ecritures-refusees.js).
import { verifierEffet } from "../ecritures-refusees.js";

// Tables en AJOUT SEUL : la RLS n'y accorde que l'insertion (paiements.sql),
// un upsert y serait refusé. Une ligne déjà présente (renvoi après une coupure
// survenue avant l'accusé de réception) est un succès, pas un doublon.
// `historique` aussi : tout le personnel y INSÈRE, mais seuls les porteurs du
// module Historique peuvent le LIRE (postes.sql). Un upsert (ON CONFLICT)
// exige la lecture : la trace d'un comptable était refusée puis jetée, et ses
// suppressions n'apparaissaient jamais dans le journal.
export const AJOUT_SEUL = new Set(["paiements", "historique"]);
const DEJA_PRESENTE = "23505"; // unique_violation (clé primaire)

// `op.op` : "PUT" | "PATCH" | "DELETE" (UpdateType de @powersync/web).
// `record` : la ligne complète (PUT), `patch` : les seules colonnes changées
// (PATCH) — colonnes jsonb déjà re-parsées par l'appelant.
export async function envoyerOperation(sb, op, { record, patch } = {}) {
  if (op.op === "PUT" && AJOUT_SEUL.has(op.table)) {
    const { error } = await sb.from(op.table).insert(record);
    if (error && error.code !== DEJA_PRESENTE) throw error;
  } else if (op.op === "PUT") {
    const { error } = await sb.from(op.table).upsert(record);
    if (error) throw error;
  } else if (op.op === "PATCH") {
    verifierEffet(await sb.from(op.table).update(patch, { count: "exact" }).eq("id", op.id), op.table, "modification");
  } else if (op.op === "DELETE") {
    verifierEffet(await sb.from(op.table).delete({ count: "exact" }).eq("id", op.id), op.table, "suppression");
  }
}
