// ── Protéger les données locales contre l'effacement par le navigateur ──────
// Le miroir hors ligne (PowerSync), les saisies pas encore envoyées et les
// photos vivent dans le stockage du navigateur. Par défaut ce stockage est
// « au mieux » : quand le disque se remplit, le navigateur peut effacer les
// données d'un site peu utilisé — saisies hors ligne comprises. Un stockage
// déclaré persistant n'est plus effacé que par l'utilisateur lui-même.
//
// Selon le navigateur :
//   • Chrome/Edge (Android, Windows) : accordé ou refusé sans question, selon
//     l'usage — app installée, site en favori, notifications autorisées… Un
//     refus n'est pas définitif : la demande est refaite à chaque ouverture.
//   • Firefox : une question est posée une fois à l'utilisateur.
//   • Safari : accordé surtout à l'app ajoutée à l'écran d'accueil.
//
// Renvoie "deja" | "accorde" | "refuse" | "indisponible". Ne lève jamais.
export async function demanderStockagePersistant() {
  const stockage = typeof navigator !== "undefined" ? navigator.storage : null;
  if (typeof stockage?.persist !== "function" || typeof stockage?.persisted !== "function") {
    return "indisponible";
  }
  try {
    if (await stockage.persisted()) return "deja";
    return (await stockage.persist()) ? "accorde" : "refuse";
  } catch {
    return "indisponible";
  }
}

// Une seule demande par ouverture de l'app, quel que soit le nombre de
// connexions ou de rafraîchissements de session pendant celle-ci.
let demande = null;
export function protegerDonneesLocales() {
  if (!demande) demande = demanderStockagePersistant();
  return demande;
}
