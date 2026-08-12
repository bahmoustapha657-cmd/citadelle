// ── Temps réel Supabase (postgres_changes) ──────────────────────────────────
// Rétablit l'instantanéité perdue quand les listeners permanents ont été retirés
// (commit e328485, « temps réel économe ») : à l'époque chaque onSnapshot
// Firestore refacturait des LECTURES en continu et vidait le quota. Le
// raisonnement ne se transpose pas à Supabase — Realtime lit le WAL Postgres et
// diffuse par WebSocket, sans consommer la moindre requête PostgREST. On peut
// donc réabonner sans réintroduire le coût qui avait motivé la suppression.
//
// Deux principes :
//   • UN canal par (table, école), partagé par tous les hooks montés. Dix écrans
//     qui lisent `notes` ouvrent un WebSocket, pas dix.
//   • Le filtre serveur ne porte que sur `ecole_id` (Realtime n'accepte qu'une
//     colonne) ; la section et l'année sont filtrées ici, côté client.
//
// Prérequis base : les tables doivent être publiées — voir supabase/realtime.sql.
// Si elles ne le sont pas, rien ne casse : on ne reçoit simplement aucun
// événement, et le rafraîchissement au retour d'onglet (useFirestore) reste le
// filet de sécurité.
import { getSupabase, supabaseConfigured } from "../supabaseClient";
import { resolveCollection } from "./collection-map";
import { construirePatch } from "./realtime-patch";
import { resoudreEcoleId } from "./data-supabase";
import { estCouvertHorsLigne, powerSyncConfigured } from "./powersync/tables";

// clé `table|ecoleId` → { channel, abonnes:Set<fn> }
const canaux = new Map();
let erreurSignalee = false;

function canalPour(sb, table, ecoleId) {
  const cle = `${table}|${ecoleId}`;
  const existant = canaux.get(cle);
  if (existant) return existant;

  const entree = { cle, channel: null, abonnes: new Set() };
  entree.channel = sb
    .channel(`rt:${cle}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `ecole_id=eq.${ecoleId}` },
      (payload) => {
        for (const fn of [...entree.abonnes]) {
          try { fn(payload); } catch { /* un abonné en échec n'en pénalise pas un autre */ }
        }
      },
    )
    .subscribe((statut) => {
      if ((statut === "CHANNEL_ERROR" || statut === "TIMED_OUT") && !erreurSignalee) {
        erreurSignalee = true;
        console.warn(
          `[realtime] canal indisponible (${statut}) — l'app reste fonctionnelle, `
          + "mais sans mise à jour instantanée. Vérifier supabase/realtime.sql.",
        );
      }
    });

  canaux.set(cle, entree);
  return entree;
}

// S'abonne aux changements d'une collection (au sens Firestore : `notesPrimaire`,
// `elevesCollege`, `recettes`…). `onChange` reçoit un patch :
//   { type: "upsert", item }  ·  { type: "delete", id }  ·  { type: "reload" }
// Renvoie la fonction de désabonnement (appelable immédiatement, même si la
// résolution de l'école est encore en vol).
export function subscribeCollection(schoolCode, nomCollection, options, onChange) {
  const { annee = null } = options || {};
  if (!supabaseConfigured || !schoolCode || typeof onChange !== "function") return () => {};

  const map = resolveCollection(nomCollection);
  if (!map) return () => {}; // collection sans table Supabase

  // PowerSync pousse déjà ses tables dans le miroir local : pas de double canal.
  if (powerSyncConfigured && estCouvertHorsLigne(map.table)) return () => {};

  let annule = false;
  let detacher = null;

  const ecouteur = (payload) => {
    const patch = construirePatch(payload, map.table, map.section, annee);
    if (patch) onChange(patch);
  };

  (async () => {
    try {
      const sb = getSupabase();
      const ecoleId = await resoudreEcoleId(schoolCode);
      if (!ecoleId || annule) return;

      const entree = canalPour(sb, map.table, ecoleId);
      entree.abonnes.add(ecouteur);
      detacher = () => {
        entree.abonnes.delete(ecouteur);
        // Dernier abonné parti : on ferme le WebSocket au lieu de le laisser filer.
        if (entree.abonnes.size === 0) {
          canaux.delete(entree.cle);
          sb.removeChannel(entree.channel);
        }
      };
    } catch {
      // Temps réel indisponible : le rafraîchissement au focus prend le relais.
    }
  })();

  return () => {
    annule = true;
    if (detacher) detacher();
  };
}
