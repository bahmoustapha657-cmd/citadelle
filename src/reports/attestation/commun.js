// Briques partagées par les deux modèles d'attestation (gabarit-diplome.js,
// gabarit-sobre.js).
import { tr } from "../print-helpers.js";
import { formatMoyenneAnnuelle } from "./attestation-moyenne.js";

// Devise imprimée en pied de page quand l'école n'en a pas saisi.
export const DEVISE_DEFAUT = "Travail – Rigueur – Réussite"; // i18n-ignore — devise par défaut, donnée en français

// Libellé d'une période sur la pièce : « 1er trimestre », « 2ème semestre » ;
// un mois (modèle mensuel) passe tel quel.
export const libellePeriode = (periode) => tr(`reports.attestation.periods.${periode}`, { defaultValue: periode });

// « 12,56 » et « 20 » séparés : le chiffre en gros, le barème en petit.
// null quand il n'y a pas de moyenne.
export const partiesMoyenne = (moy, maxNote = 20) => {
  if (moy == null) return null;
  const [valeur, sur] = formatMoyenneAnnuelle(moy, maxNote).split("/");
  return { valeur, sur };
};

// Au-delà de trois périodes (modèle mensuel : neuf mois), les cases se
// resserrent.
export const periodesNombreuses = (resultats) => (resultats?.periodes.length || 0) > 3;
