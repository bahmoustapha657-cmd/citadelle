// Moyenne annuelle imprimée sur l'attestation.
//
// On réutilise EXACTEMENT le pipeline du bulletin de fin d'année : notes
// annuelles synthétiques (moyenne des périodes, matière par matière) puis
// moyenne générale pondérée par les coefficients. Recalculer autrement ferait
// courir le risque qu'une attestation et le bulletin de la même année
// annoncent deux moyennes différentes — le premier parent qui compare les deux
// feuilles a raison contre nous.
import { getGeneralAverage } from "../../note-utils.js";
import { buildBulletinNotesAnnuelles } from "../bulletins/annual-notes.js";

// Renvoie la moyenne annuelle (nombre) ou null quand elle n'a pas de sens :
// données manquantes, ou élève sans aucune note sur l'année.
export function getMoyenneAnnuelleEleve({ eleve, notes = [], matieres = [], periodes = [], niveau = "" } = {}) {
  if (!eleve?._id || !notes.length || !matieres.length || !periodes.length) return null;

  const notesAnnuelles = buildBulletinNotesAnnuelles({
    eleves: [eleve], notes, matsFor: () => matieres, periodes, niveau,
  });

  // Élève pas encore noté : on n'imprime AUCUNE moyenne. Sans ce garde-fou
  // getGeneralAverage renverrait 0 — les matières sans note comptent 0 au
  // numérateur mais gardent leur coefficient au dénominateur — et l'attestation
  // annoncerait « 0,00/20 » à un élève qui n'a simplement pas encore composé.
  if (!notesAnnuelles.length) return null;

  return getGeneralAverage(notesAnnuelles, matieres, eleve.classe, niveau);
}

// Formatage pour le document : « 14,25/20 ». Renvoie "" si pas de moyenne,
// l'appelant supprime alors la ligne au lieu d'imprimer un tiret.
export function formatMoyenneAnnuelle(moyenne, maxNote = 20) {
  return moyenne == null ? "" : `${moyenne.toFixed(2).replace(".", ",")}/${maxNote}`;
}
