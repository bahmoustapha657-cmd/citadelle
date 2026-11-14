// ── Connecteur PowerSync ↔ Supabase ─────────────────────────────────────────
// fetchCredentials() : réutilise la session Supabase déjà gérée par
// supabaseClient.js (aucune auth séparée à poser côté PowerSync).
// uploadData() : rejoue la file locale via le MÊME client supabase-js que le
// reste de l'app → la RLS reste la seule autorité d'écriture, PowerSync ne la
// contourne jamais.
import { getSupabase } from "../../supabaseClient";
import { parseJsonCols } from "./tables";
import { envoyerOperation, estErreurPassagere, exigerSession } from "./envoi-operation";
import { signalerEcritureRefusee } from "../ecritures-refusees";
import { garderRefus } from "./garde-refus";
import { compterSaisiesDeCote, renvoyerSaisiesDeCote } from "./saisies-de-cote";

const POWERSYNC_URL = String(import.meta.env?.VITE_POWERSYNC_URL || "").trim();

// Envoi d'une opération (ajout seul, upsert, modification, suppression) et
// tri entre incident passager (à réessayer plus tard) et refus définitif
// (RLS, validation…) qu'il faut abandonner pour ne pas bloquer la file à
// l'infini : envoi-operation.js.

// Les colonnes jsonb Postgres vivent en TEXT côté SQLite : re-parser avant
// l'envoi, sinon PostgREST stockerait une CHAÎNE dans le jsonb.
const donneesEnvoi = (op) => ({
  record: parseJsonCols(op.table, { ...op.opData, id: op.id }),
  patch: parseJsonCols(op.table, op.opData),
  precedent: op.previousValues ? parseJsonCols(op.table, op.previousValues) : undefined,
});

// Refus définitif : la saisie va disparaître de l'écran à la synchro
// suivante. Elle est donc GARDÉE avant (garde-refus.js) — trace dans le
// journal de l'école et, pour une inscription ou un encaissement, bandeau
// « à régulariser » sur cet appareil —, en plus de l'avertissement immédiat.
async function signalerRefus(database, op, err) {
  const motif = await garderRefus(database, op, err);
  signalerEcritureRefusee({
    table: op?.table, operation: op?.op, id: op?.id,
    message: motif || err?.message || String(err), horsLigne: true,
  });
}

// Saisies que `uid` avait laissées sur l'appareil avant qu'un autre compte
// ne vide le miroir (saisies-de-cote.js). Envoyées SEULEMENT avec la session
// de leur auteur : celle d'un autre compte ne les envoie jamais. Renvoie le
// nombre de saisies qui restent à envoyer.
export async function envoyerSaisiesDeCote(uid, database) {
  if (!compterSaisiesDeCote(uid)) return 0;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession().catch(() => ({ data: null }));
  const session = data?.session;
  if (!session?.access_token || session.user?.id !== uid) return compterSaisiesDeCote(uid);
  const { restantes } = await renvoyerSaisiesDeCote(uid, {
    envoyer: (op) => envoyerOperation(sb, op, donneesEnvoi(op)),
    estPassagere: (err) => estErreurPassagere(err, { enLigne: navigator.onLine }),
    surRefus: (op, err) => signalerRefus(database, op, err),
  });
  return restantes;
}

export class SupabaseConnector {
  // `uid` : compte dont la synchro est ouverte (client.js).
  constructor(uid = null) {
    this.uid = uid;
  }

  async fetchCredentials() {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    return { endpoint: POWERSYNC_URL, token: session.access_token };
  }

  async uploadData(database) {
    // Saisies de ce compte mises de côté : plus anciennes que toute la file,
    // elles partent d'abord. S'il en reste (réseau, session), PowerSync
    // réessaiera plus tard, sans rien envoyer de plus récent avant elles.
    if (this.uid && await envoyerSaisiesDeCote(this.uid, database)) {
      // i18n-ignore — erreur interne, jamais affichée
      throw Object.assign(new Error("Saisies mises de côté pas encore envoyées"), { status: 0 });
    }

    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    const sb = getSupabase();
    let enCours = null;
    try {
      // Sans session valide, supabase-js enverrait la file avec la clé
      // anonyme : la RLS la refuserait et chaque écriture serait jetée comme
      // « refus définitif ». On attend plutôt la reconnexion (cf. exigerSession).
      await exigerSession(sb);
      for (const op of transaction.crud) {
        enCours = op;
        await envoyerOperation(sb, op, donneesEnvoi(op));
      }
      await transaction.complete();
    } catch (err) {
      // PowerSync retentera à la reconnexion.
      if (estErreurPassagere(err, { enLigne: navigator.onLine })) throw err;
      // Refus définitif (RLS, fiche supprimée entre-temps, validation) : on
      // abandonne la transaction plutôt que de bloquer la file à l'infini.
      await signalerRefus(database, enCours, err);
      await transaction.complete();
    }
  }
}
