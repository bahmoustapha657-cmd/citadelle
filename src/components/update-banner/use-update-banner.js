import { useState, useSyncExternalStore } from "react";
import { ecouterMiseAJour, etatMiseAJour, rechargerMaintenant } from "../../mise-a-jour/mise-a-jour-auto";

// Bouton « Recharger » : choix de l'utilisateur, appliqué tout de suite
// (y compris pendant une saisie : c'est lui qui décide).
export function activateWaitingWorker() {
  rechargerMaintenant();
}

// État de la mise à jour automatique (mise-a-jour/mise-a-jour-auto.js) :
// - autoToast : rechargement imminent (message bref) ;
// - available : nouvelle version en attente d'un moment sûr (travail en
//   cours, utilisation active) → bandeau avec bouton « Recharger ».
// « Plus tard » masque le bandeau pour cette version ; elle s'installera
// d'elle-même au prochain moment sûr.
export function useUpdateBanner() {
  const etat = useSyncExternalStore(ecouterMiseAJour, etatMiseAJour);
  const [masquee, setMasquee] = useState(null);

  return {
    autoToast: etat.rechargement,
    available: etat.bandeau && !!etat.cible && masquee !== etat.cible,
    plusTard: () => setMasquee(etat.cible),
  };
}
