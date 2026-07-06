// ── Bootstrap PowerSync (singleton, paresseux) ──────────────────────────────
// Même esprit que supabaseClient.js : instance unique créée à la demande.
// Si VITE_POWERSYNC_URL est vide (instance PowerSync Cloud pas encore créée),
// le hors-ligne reste simplement désactivé — le reste de l'app Supabase
// continue de fonctionner normalement (comportement actuel inchangé).
import { PowerSyncDatabase } from "@powersync/web";
import { AppSchema } from "./schema";
import { SupabaseConnector } from "./connector";
import { powerSyncConfigured } from "./tables";

export { powerSyncConfigured };

let db = null;
export function getPowerSync() {
  if (!db) {
    db = new PowerSyncDatabase({
      schema: AppSchema,
      database: { dbFilename: "edugest.sqlite" },
    });
  }
  return db;
}

let connexion = null;
export function connectPowerSync() {
  if (!powerSyncConfigured) return Promise.resolve();
  if (!connexion) {
    connexion = getPowerSync()
      .connect(new SupabaseConnector())
      .catch((err) => {
        connexion = null;
        console.warn("[powersync] connexion échouée :", err?.message || err);
      });
  }
  return connexion;
}

// Appelé à la déconnexion : coupe la sync ET vide le miroir local (le
// poste peut être partagé entre plusieurs comptes/écoles — éviter qu'un
// compte suivant retrouve les données hors ligne du précédent).
export async function disconnectPowerSync() {
  connexion = null;
  if (!db) return;
  try {
    await db.disconnectAndClear();
  } catch (err) {
    console.warn("[powersync] déconnexion :", err?.message || err);
  }
}
