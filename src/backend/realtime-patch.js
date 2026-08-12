// ── Traduction d'un événement Postgres en patch de liste ────────────────────
// Isolé du client Supabase (aucun import de supabaseClient) pour rester pur et
// testable sous Node : c'est ici que se joue la justesse de l'affichage temps
// réel, donc la partie qui mérite des tests. Voir realtime-supabase.js pour le
// transport (canaux, abonnements).
import { transformRow } from "./collection-map";

// Le hook lit une TRANCHE de la table (une section, parfois une année) ; le
// filtre serveur, lui, ne connaît que l'école (Realtime n'accepte qu'une seule
// colonne de filtre). On tranche donc ici.
export function dansPerimetre(ligne, section, annee) {
  if (section && ligne.section != null && ligne.section !== section) return false;
  if (annee && ligne.annee != null && ligne.annee !== annee) return false;
  return true;
}

// Traduit l'événement en instruction pour l'appelant. On applique la ligne reçue
// TELLE QUELLE (via le même transformRow que la lecture normale) au lieu de
// relire la collection : un changement distant coûte alors zéro requête — ce qui
// compte quand la table fait 7 000 notes paginées par 1 000.
//
// Retourne { type: "upsert", item } · { type: "delete", id } · { type: "reload" }
// ou null si l'événement ne concerne pas ce hook.
export function construirePatch(payload, table, section, annee) {
  const plein = (o) => (o && Object.keys(o).length ? o : null);
  const apres = plein(payload?.new);
  const avant = plein(payload?.old);

  if (payload?.eventType === "DELETE") {
    // Sans REPLICA IDENTITY FULL, `old` se réduit à la clé primaire — assez pour
    // retirer la ligne (et si l'id n'est pas dans la liste, le retrait est un
    // no-op inoffensif). Sans id du tout, on ne peut que relire.
    if (!avant?.id) return { type: "reload" };
    return { type: "delete", id: avant.id };
  }

  if (!apres) return { type: "reload" }; // payload dégradé : repli sûr
  if (dansPerimetre(apres, section, annee)) {
    return { type: "upsert", item: transformRow(table, apres) };
  }
  // La ligne existe toujours mais a quitté le périmètre (élève changé de
  // section, note rebasculée sur une autre année) : elle doit disparaître de
  // CETTE vue, même si elle reste visible ailleurs.
  return apres.id ? { type: "delete", id: apres.id } : null;
}
