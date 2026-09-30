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

// Colonne qui porte l'école, quand ce n'est pas `ecole_id`. La table `ecoles`
// n'en a pas : la ligne EST l'école, on filtre donc sur sa clé primaire.
const COLONNE_ECOLE = { ecoles: "id" };
const colonneEcole = (table) => COLONNE_ECOLE[table] || "ecole_id";

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
      { event: "*", schema: "public", table, filter: `${colonneEcole(table)}=eq.${ecoleId}` },
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

// Branche un écouteur sur le canal (table, école) et renvoie son détachement.
// Facteur commun de subscribeCollection et subscribeTable.
function attacher(schoolCode, table, ecouteur) {
  let annule = false;
  let detacher = null;

  (async () => {
    try {
      const sb = getSupabase();
      const ecoleId = await resoudreEcoleId(schoolCode);
      if (!ecoleId || annule) return;

      const entree = canalPour(sb, table, ecoleId);
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

  // Table en miroir local (PowerSync) : pas de canal Realtime en double — on
  // écoute le miroir lui-même. Sans cette écoute, un écran ouvert juste après
  // la connexion lisait un miroir encore vide et le restait jusqu'au
  // changement de module (flagrant sur réseau faible, où la première synchro
  // dure) ; les saisies des autres postes n'apparaissaient pas non plus.
  if (powerSyncConfigured && estCouvertHorsLigne(map.table)) {
    return ecouterMiroir([map.table], () => onChange({ type: "reload" }));
  }

  return attacher(schoolCode, map.table, (payload) => {
    const patch = construirePatch(payload, map.table, map.section, annee);
    if (patch) onChange(patch);
  });
}

// S'abonne aux changements du miroir local PowerSync sur ces tables (données
// livrées par la synchro ou écriture locale) ; `rappel` est appelé sans
// argument. Le moteur n'est chargé qu'en `import()`, et seulement si PowerSync
// est configuré. Renvoie la fonction de désabonnement, appelable aussitôt.
export function ecouterMiroir(tables, rappel) {
  if (!powerSyncConfigured || typeof rappel !== "function") return () => {};
  let arreter = null;
  let annule = false;
  import("./powersync/client").then(({ ecouterTables }) => {
    if (!annule) arreter = ecouterTables(tables, rappel);
  }).catch(() => {});
  return () => { annule = true; arreter?.(); };
}

// S'abonne aux changements BRUTS d'une table, hors mapping des collections :
// `ecoles` (paramètres de l'établissement) et `postes` (droits) ne se lisent
// pas via useFirestore, elles ont leur propre chargement. `onChange` est
// appelée SANS argument utile — ces écrans se contentent de recharger, ce qui
// évite d'avoir à reconstruire un item à partir du payload.
export function subscribeTable(schoolCode, table, onChange) {
  if (!supabaseConfigured || !schoolCode || !table || typeof onChange !== "function") return () => {};
  return attacher(schoolCode, table, () => onChange());
}

// Comme subscribeTable, mais `onPayload` reçoit l'événement postgres_changes
// BRUT ({ eventType, new, old }) : la messagerie ajoute le message reçu au
// fil ouvert sans recharger toute la discussion.
export function subscribeTablePayload(schoolCode, table, onPayload) {
  if (!supabaseConfigured || !schoolCode || !table || typeof onPayload !== "function") return () => {};
  return attacher(schoolCode, table, onPayload);
}
