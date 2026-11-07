// Moyenne annuelle imprimée sur l'attestation.
//
// On réutilise EXACTEMENT le pipeline du bulletin de fin d'année : notes
// annuelles synthétiques (moyenne des périodes, matière par matière) puis
// moyenne générale pondérée par les coefficients. Recalculer autrement ferait
// courir le risque qu'une attestation et le bulletin de la même année
// annoncent deux moyennes différentes — le premier parent qui compare les deux
// feuilles a raison contre nous.
import { anneePrecedente } from "../../constants.js";
import { getGeneralAverage, matieresNotees } from "../../note-utils.js";
import { classePourAnnee } from "../../components/admin/cloture-annee-utils.js";
import { buildBulletinNotesAnnuelles } from "../bulletins/annual-notes.js";

// Renvoie la moyenne annuelle (nombre) ou null quand elle n'a pas de sens :
// données manquantes, ou élève sans aucune note sur l'année.
// `camarades` : les élèves de sa classe cette année-là. Une matière que
// personne n'y a notée ne compte pas (matieresNotees), comme au bulletin.
// Sans eux, toutes les matières de la classe, comme avant.
export function getMoyenneAnnuelleEleve({ eleve, notes = [], matieres = [], periodes = [], niveau = "", camarades = null } = {}) {
  if (!eleve?._id || !notes.length || !matieres.length || !periodes.length) return null;

  const notesAnnuelles = buildBulletinNotesAnnuelles({
    eleves: [eleve], notes, matsFor: () => matieres, periodes, niveau,
  });

  // Élève pas encore noté : on n'imprime AUCUNE moyenne. Sans ce garde-fou
  // getGeneralAverage renverrait 0 — les matières sans note comptent 0 au
  // numérateur mais gardent leur coefficient au dénominateur — et l'attestation
  // annoncerait « 0,00/20 » à un élève qui n'a simplement pas encore composé.
  if (!notesAnnuelles.length) return null;

  const ids = camarades ? new Set(camarades.map((e) => e._id)) : null;
  const comptees = ids ? matieresNotees(matieres, notes.filter((n) => ids.has(n.eleveId))) : matieres;
  return getGeneralAverage(notesAnnuelles, comptees, eleve.classe, niveau);
}

// Formatage pour le document : « 14,25/20 ». Renvoie "" si pas de moyenne,
// l'appelant supprime alors la ligne au lieu d'imprimer un tiret.
export function formatMoyenneAnnuelle(moyenne, maxNote = 20) {
  return moyenne == null ? "" : `${moyenne.toFixed(2).replace(".", ",")}/${maxNote}`;
}

// Helper d'année scolaire commun (il sert aussi aux dispenses de paiement,
// reconduites d'une année sur l'autre) ; réexporté pour les appelants
// historiques de ce module.
export { anneePrecedente };

// Moyenne à IMPRIMER, avec son année.
//
// À la rentrée, l'année en cours n'a encore aucune note : l'attestation
// sortait alors sans moyenne, au moment précis où les familles en réclament une
// (dossier d'inscription ailleurs, bourse, concours). On retombe donc sur
// l'ANNÉE ÉCOULÉE — c'est la dernière moyenne réellement acquise, et le
// document imprime l'année à laquelle elle se rapporte, jamais un chiffre
// orphelin qu'on croirait de l'année en cours.
//
// L'année en cours reste prioritaire dès qu'elle porte une seule note : une
// moyenne de première période vaut mieux qu'une moyenne périmée.
// `eleves` (facultatif) : les élèves de la section, pour juger les matières
// notées dans la classe de chaque année.
export function getMoyenneAttestation({
  eleve, matieres = [], periodes = [], niveau = "", annee = "",
  notes = [], notesPrecedentes = [], eleves = null,
} = {}) {
  const commun = { eleve, matieres, periodes, niveau };
  const camaradesEn = (an) => {
    if (!eleves) return null;
    const classe = classePourAnnee(eleve, an);
    return eleves.filter((e) => classePourAnnee(e, an) === classe);
  };

  const courante = getMoyenneAnnuelleEleve({ ...commun, notes, camarades: camaradesEn(annee) });
  if (courante != null) return { moyenne: courante, annee };

  const precedente = getMoyenneAnnuelleEleve({ ...commun, notes: notesPrecedentes, camarades: camaradesEn(anneePrecedente(annee)) });
  if (precedente != null) return { moyenne: precedente, annee: anneePrecedente(annee) };

  return { moyenne: null, annee: "" };
}
