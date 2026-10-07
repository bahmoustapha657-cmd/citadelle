// ── Connecteur PowerSync ↔ Supabase ─────────────────────────────────────────
// fetchCredentials() : réutilise la session Supabase déjà gérée par
// supabaseClient.js (aucune auth séparée à poser côté PowerSync).
// uploadData() : rejoue la file locale via le MÊME client supabase-js que le
// reste de l'app → la RLS reste la seule autorité d'écriture, PowerSync ne la
// contourne jamais.
import { UpdateType } from "@powersync/web";
import { getSupabase } from "../../supabaseClient";
import { parseJsonCols } from "./tables";

const POWERSYNC_URL = String(import.meta.env?.VITE_POWERSYNC_URL || "").trim();

// Erreur réseau (à réessayer plus tard) vs erreur serveur définitive (RLS,
// validation…) qu'il faut abandonner pour ne pas bloquer la file à l'infini.
function estErreurReseau(err) {
  if (!navigator.onLine) return true;
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout");
}

// Tables en AJOUT SEUL : la RLS n'y accorde que l'insertion (paiements.sql),
// un upsert y serait refusé. Une ligne déjà présente (renvoi après une coupure
// survenue avant l'accusé de réception) est un succès, pas un doublon.
// `historique` aussi : tout le personnel y INSÈRE, mais seuls les porteurs du
// module Historique peuvent le LIRE (postes.sql). Un upsert (ON CONFLICT)
// exige la lecture : la trace d'un comptable était refusée puis jetée, et ses
// suppressions n'apparaissaient jamais dans le journal.
const AJOUT_SEUL = new Set(["paiements", "historique"]);
const DEJA_PRESENTE = "23505"; // unique_violation (clé primaire)

export class SupabaseConnector {
  async fetchCredentials() {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    return { endpoint: POWERSYNC_URL, token: session.access_token };
  }

  async uploadData(database) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const sb = getSupabase();
    try {
      for (const op of transaction.crud) {
        // Les colonnes jsonb Postgres vivent en TEXT côté SQLite : re-parser
        // avant l'envoi, sinon PostgREST stockerait une CHAÎNE dans le jsonb.
        const record = parseJsonCols(op.table, { ...op.opData, id: op.id });
        if (op.op === UpdateType.PUT && AJOUT_SEUL.has(op.table)) {
          const { error } = await sb.from(op.table).insert(record);
          if (error && error.code !== DEJA_PRESENTE) throw error;
        } else if (op.op === UpdateType.PUT) {
          const { error } = await sb.from(op.table).upsert(record);
          if (error) throw error;
        } else if (op.op === UpdateType.PATCH) {
          const { error } = await sb.from(op.table).update(parseJsonCols(op.table, op.opData)).eq("id", op.id);
          if (error) throw error;
        } else if (op.op === UpdateType.DELETE) {
          const { error } = await sb.from(op.table).delete().eq("id", op.id);
          if (error) throw error;
        }
      }
      await transaction.complete();
    } catch (err) {
      if (estErreurReseau(err)) throw err; // PowerSync retentera à la reconnexion
      // Erreur serveur définitive (ex. refus RLS) : on abandonne cette
      // transaction plutôt que de bloquer indéfiniment la file d'upload.
      console.error("[powersync] écriture rejetée par Supabase :", err?.message || err);
      await transaction.complete();
    }
  }
}
