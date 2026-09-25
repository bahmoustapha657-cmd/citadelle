import { getTarifFraisDivers } from "../../../constants";
import { imprimerRecu, imprimerRecuTicket } from "../../../reports";
import {
  getEleveSolde, getTarifConfigForClasse, getTarifInscriptionForEleve, getTarifMensuelForClasse,
} from "../../../mensualite-utils";

// Imprime le reçu d'un élève dans le format choisi (a4, 58 ou 80 mm), avec le
// reste à payer (`annee` : celle des fiches, pour la règle des départs).
// `versement` (facultatif) : le paiement qui vient d'être encaissé —
// { date, total, lignes: [{ libelle, montant }] } — mis en avant sur le reçu.
// À appeler dans le geste de l'utilisateur (ouverture de fenêtre).
export function imprimerRecuEleve({
  eleve, tarifsClasses = [], moisAnnee = [], annee, schoolInfo = {}, format = "a4", versement = null,
}) {
  const tarif = getTarifConfigForClasse(tarifsClasses, eleve.classe);
  const frais = {
    inscription: getTarifInscriptionForEleve(eleve, tarifsClasses),
    autre: Number(tarif?.autre || 0),
    revision: Number(tarif?.revision || 0),
    divers: getTarifFraisDivers(tarif || {}),
  };
  const options = { versement, resteAPayer: getEleveSolde(eleve, moisAnnee, tarifsClasses, annee) };
  const mensualite = getTarifMensuelForClasse(tarifsClasses, eleve.classe);
  if (format === "a4") return imprimerRecu(eleve, mensualite, schoolInfo, moisAnnee, frais, options);
  return imprimerRecuTicket(eleve, mensualite, schoolInfo, moisAnnee, frais, Number(format), options);
}
