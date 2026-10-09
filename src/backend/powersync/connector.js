// ── Connecteur PowerSync ↔ Supabase ─────────────────────────────────────────
// fetchCredentials() : réutilise la session Supabase déjà gérée par
// supabaseClient.js (aucune auth séparée à poser côté PowerSync).
// uploadData() : rejoue la file locale via le MÊME client supabase-js que le
// reste de l'app → la RLS reste la seule autorité d'écriture, PowerSync ne la
// contourne jamais.
import { getSupabase } from "../../supabaseClient";
import { parseJsonCols } from "./tables";
import { envoyerOperation } from "./envoi-operation";
import { signalerEcritureRefusee } from "../ecritures-refusees";

const POWERSYNC_URL = String(import.meta.env?.VITE_POWERSYNC_URL || "").trim();

// Erreur réseau (à réessayer plus tard) vs erreur serveur définitive (RLS,
// validation…) qu'il faut abandonner pour ne pas bloquer la file à l'infini.
function estErreurReseau(err) {
  if (!navigator.onLine) return true;
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timeout");
}

// Envoi d'une opération (ajout seul, upsert, modification, suppression) :
// envoi-operation.js.

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
    let enCours = null;
    try {
      for (const op of transaction.crud) {
        enCours = op;
        // Les colonnes jsonb Postgres vivent en TEXT côté SQLite : re-parser
        // avant l'envoi, sinon PostgREST stockerait une CHAÎNE dans le jsonb.
        await envoyerOperation(sb, op, {
          record: parseJsonCols(op.table, { ...op.opData, id: op.id }),
          patch: parseJsonCols(op.table, op.opData),
        });
      }
      await transaction.complete();
    } catch (err) {
      if (estErreurReseau(err)) throw err; // PowerSync retentera à la reconnexion
      // Refus définitif (RLS, fiche supprimée entre-temps, validation) : on
      // abandonne la transaction plutôt que de bloquer la file à l'infini —
      // mais l'utilisateur est AVERTI (la saisie va disparaître de l'écran à
      // la synchro suivante), et le refus est gardé dans le journal de
      // l'appareil. Auparavant : un simple console.error.
      signalerEcritureRefusee({
        table: enCours?.table, operation: enCours?.op, id: enCours?.id,
        message: err?.message || String(err), horsLigne: true,
      });
      await transaction.complete();
    }
  }
}
