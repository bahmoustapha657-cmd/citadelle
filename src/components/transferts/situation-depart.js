// Situation d'un élève parti, telle que la certifient les documents de sortie
// (certificat de radiation, ordre de mutation) et le dossier de transfert :
// l'année qu'il a réellement faite en dernier, la classe qu'il y occupait et
// ce qu'il doit encore sur cette année-là.
//
// La fiche courante décrit l'année officielle. Un élève parti pendant les
// vacances qui précèdent la rentrée (le 15 septembre, avant les cours
// d'octobre) n'a rien fait de cette année : c'est l'année d'avant, archivée
// par la clôture, qui dit sa classe et ce qu'il doit. Le certificat imprimait
// auparavant l'année de l'écran et un solde de neuf mois qu'il ne devait pas.
//
// Extensions explicites : module couvert par des tests Node.
import { derniereAnneeFrequentee, lireDate } from "../../depart-utils.js";
import { getEleveSolde } from "../../mensualite-utils.js";
import { classePourAnnee, scolaritePourAnnee } from "../admin/cloture-annee-utils.js";

export function situationAuDepart(eleve = {}, { moisAnnee = [], tarifsClasses = [], anneeOfficielle = "" } = {}) {
  const annee = derniereAnneeFrequentee(eleve, moisAnnee) || anneeOfficielle;
  // L'année faite n'est pas l'officielle : sa scolarité est dans l'archive.
  // Sans archive, on ne sait rien de plus que la fiche courante, lue pour
  // l'année officielle.
  const archive = annee !== anneeOfficielle && (eleve.historique || {})[annee];
  const fiche = archive ? scolaritePourAnnee(eleve, annee, anneeOfficielle) : eleve;
  const date = lireDate(eleve.dateDepart);
  return {
    annee,
    classe: (archive ? classePourAnnee(eleve, annee) : eleve.classe) || eleve.classe || "",
    solde: getEleveSolde(fiche, moisAnnee, tarifsClasses, archive ? annee : anneeOfficielle),
    // JJ/MM/AAAA pour les documents ; "" si la date manque.
    dateDepart: date ? date.toLocaleDateString("fr-FR") : "",
  };
}
