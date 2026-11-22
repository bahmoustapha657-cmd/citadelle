// Résultats imprimés sur l'attestation : moyenne générale de chaque période
// (trimestres, semestres ou mois, selon le modèle d'évaluation de l'école)
// et moyenne annuelle.
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
import { getMoyennesPeriodes } from "../bulletins/bulletin-helpers.js";

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

// Résultats à IMPRIMER, pour UNE année : { annee, classe, periodes:
// [{ periode, moy }], annuelle } — ou null quand il n'y a rien à montrer.
//
// L'année est celle de la DERNIÈRE CLASSE SUIVIE (`derniere`, cf.
// derniere-classe.js) : la pièce annonce « 9ème A (2025-2026) », ses chiffres
// sont ceux de la 9ème A en 2025-2026 — jamais une moyenne de 10ème entamée,
// qui la contredirait.
//
// Classe inconnue ou sans année (élève venu d'ailleurs) : l'année qu'il suit
// (`anneeEnCours`, celle du départ pour un élève parti), sinon la précédente.
//
// Chaque période est calculée comme au bulletin (getMoyennesPeriodes, les
// matières comptées par la classe), la moyenne annuelle comme au bulletin de
// fin d'année. Celle-ci n'est imprimée que sur une année ACHEVÉE, ou dont
// toutes les périodes sont notées : en cours d'année, la règle du bulletin
// (périodes vides comptées 0) annoncerait une moyenne au rabais.
//
// Seules les notes de l'année de l'écran (`notes`) et de la précédente
// (`notesPrecedentes`) sont chargées : une autre année n'imprime rien.
// `matieresForClasse` (facultatif) : les matières de la classe de CETTE
// année-là, à défaut `matieres`. `eleves` (facultatif) : les élèves de la
// section, pour juger les matières notées dans la classe.
export function getResultatsAttestation({
  eleve, matieres = [], matieresForClasse = null, periodes = [], niveau = "",
  annee = "", anneeEnCours = annee, derniere = null,
  notes = [], notesPrecedentes = [], eleves = null,
} = {}) {
  if (!eleve?._id || !periodes.length) return null;
  const notesDe = (an) => {
    if (!an) return [];
    if (an === annee) return notes;
    return an === anneePrecedente(annee) ? notesPrecedentes : [];
  };

  const resultatsDe = (an, { classe: classeConnue = "", achevee = false } = {}) => {
    const notesAn = notesDe(an);
    if (!notesAn.length) return null;
    const classe = classeConnue || classePourAnnee(eleve, an);
    const eleveAn = { ...eleve, classe };
    const propres = matieresForClasse ? matieresForClasse(classe) : null;
    const mats = propres && propres.length ? propres : matieres;
    if (!mats.length) return null;
    const camarades = eleves ? eleves.filter((e) => classePourAnnee(e, an) === classe) : null;

    const parPeriode = getMoyennesPeriodes(eleveAn, notesAn, mats, classe, niveau, periodes, camarades);
    if (!parPeriode.some((p) => p.moy != null)) return null;
    const complete = achevee || parPeriode.every((p) => p.moy != null);
    const annuelle = complete
      ? getMoyenneAnnuelleEleve({ eleve: eleveAn, notes: notesAn, matieres: mats, periodes, niveau, camarades })
      : null;
    return { annee: an, classe, periodes: parPeriode, annuelle };
  };

  if (derniere?.annee) return resultatsDe(derniere.annee, { classe: derniere.classe, achevee: true });
  return resultatsDe(anneeEnCours)
    || resultatsDe(anneePrecedente(anneeEnCours), { achevee: true });
}
