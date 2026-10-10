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

// Incident PASSAGER : la requête n'est pas arrivée (statut 0 : coupure,
// délai, « Failed to fetch » sous Chrome, « Load failed » sous Safari) ou le
// serveur a répondu « réessayez » (passerelle, surcharge, délai). L'écriture
// reste en file et repart plus tard ; tout le reste est un refus définitif,
// abandonné (cf. connector.js). Auparavant seul le TEXTE de l'erreur était
// lu : un 503 passager, ou une coupure sous Safari, abandonnait l'écriture —
// une ligne du journal de caisse, par exemple. 500 n'est pas passager : une
// erreur interne peut se reproduire à l'identique et bloquerait la file.
const STATUTS_PASSAGERS = new Set([0, 408, 425, 429, 502, 503, 504, 520, 521, 522, 523, 524]);

export function estErreurPassagere(err, { enLigne = true } = {}) {
  if (!enLigne) return true;
  if (STATUTS_PASSAGERS.has(err?.status)) return true;
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("load failed")
    || msg.includes("network") || msg.includes("timeout");
}

// Erreur supabase-js → exception qui garde le code et le statut HTTP de la
// réponse (le statut n'est porté que par la réponse, pas par l'erreur).
function echec({ error, status }) {
  return Object.assign(new Error(error.message), { code: error.code, status });
}

// `op.op` : "PUT" | "PATCH" | "DELETE" (UpdateType de @powersync/web).
// `record` : la ligne complète (PUT), `patch` : les seules colonnes changées
// (PATCH) — colonnes jsonb déjà re-parsées par l'appelant.
export async function envoyerOperation(sb, op, { record, patch } = {}) {
  if (op.op === "PUT" && AJOUT_SEUL.has(op.table)) {
    const reponse = await sb.from(op.table).insert(record);
    if (reponse.error && reponse.error.code !== DEJA_PRESENTE) throw echec(reponse);
  } else if (op.op === "PUT") {
    const reponse = await sb.from(op.table).upsert(record);
    if (reponse.error) throw echec(reponse);
  } else if (op.op === "PATCH") {
    const reponse = await sb.from(op.table).update(patch, { count: "exact" }).eq("id", op.id);
    if (reponse.error) throw echec(reponse);
    verifierEffet(reponse, op.table, "modification");
  } else if (op.op === "DELETE") {
    const reponse = await sb.from(op.table).delete({ count: "exact" }).eq("id", op.id);
    if (reponse.error) throw echec(reponse);
    verifierEffet(reponse, op.table, "suppression");
  }
}
