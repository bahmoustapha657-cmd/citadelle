import { useState } from "react";

// Année consultée d'un module (École, Comptabilité) : l'année de référence,
// tant que l'utilisateur n'en a pas choisi une autre dans le sélecteur.
//
// L'ancien `useState(anneeReference)` figeait l'année du PREMIER rendu. Or au
// rechargement de la page, le module s'affiche souvent avant la fiche de
// l'école : il démarrait sur l'année gardée en cache par l'appareil — parfois
// une année archivée — et y restait bloqué une fois la vraie année arrivée,
// d'où « l'année archivée qui s'active quand j'actualise ».
//
// On ne retient donc que le CHOIX de l'utilisateur ; sans choix, l'année
// consultée suit la référence, y compris quand celle-ci change.
export function useAnneeConsultee(anneeReference) {
  const [choix, setChoix] = useState(null);
  const anneeConsultee = choix || anneeReference;
  const setAnneeConsultee = (val) => setChoix(val && val !== anneeReference ? val : null);
  return [anneeConsultee, setAnneeConsultee];
}
