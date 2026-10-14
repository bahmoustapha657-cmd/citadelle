import { getTarifFraisDivers } from "../../../constants";
import { imprimerRecu, imprimerRecuFamille, imprimerRecuTicket } from "../../../reports";
import {
  getEleveSolde, getTarifConfigForClasse, getTarifInscriptionForEleve, getTarifMensuelForClasse,
} from "../../../mensualite-utils";

// Tarifs de la classe de l'élève et reste à payer : ce qu'il faut au reçu,
// individuel ou famille (`annee` : celle des fiches, pour la règle des départs).
const donneesRecu = (eleve, tarifsClasses, moisAnnee, annee) => {
  const tarif = getTarifConfigForClasse(tarifsClasses, eleve.classe);
  return {
    eleve,
    montantUnit: getTarifMensuelForClasse(tarifsClasses, eleve.classe),
    fraisAnnexes: {
      inscription: getTarifInscriptionForEleve(eleve, tarifsClasses),
      autre: Number(tarif?.autre || 0),
      revision: Number(tarif?.revision || 0),
      divers: getTarifFraisDivers(tarif || {}),
    },
    resteAPayer: getEleveSolde(eleve, moisAnnee, tarifsClasses, annee),
  };
};

// Imprime le reçu d'un élève dans le format choisi (a4, 58 ou 80 mm), avec le
// reste à payer.
// `versement` (facultatif) : le paiement qui vient d'être encaissé —
// { date, total, lignes: [{ libelle, montant }] } — mis en avant sur le reçu.
// À appeler dans le geste de l'utilisateur (ouverture de fenêtre).
export function imprimerRecuEleve({
  eleve, tarifsClasses = [], moisAnnee = [], annee, schoolInfo = {}, format = "a4", versement = null,
}) {
  const { montantUnit, fraisAnnexes, resteAPayer } = donneesRecu(eleve, tarifsClasses, moisAnnee, annee);
  const options = { versement, resteAPayer };
  if (format === "a4") return imprimerRecu(eleve, montantUnit, schoolInfo, moisAnnee, fraisAnnexes, options);
  return imprimerRecuTicket(eleve, montantUnit, schoolInfo, moisAnnee, fraisAnnexes, Number(format), options);
}

// Un seul reçu pour plusieurs enfants d'un même tuteur (cf. fratrie.js).
export function imprimerRecuFamilleEleves({
  eleves = [], tarifsClasses = [], moisAnnee = [], annee, schoolInfo = {}, format = "a4",
}) {
  const enfants = eleves.map((e) => donneesRecu(e, tarifsClasses, moisAnnee, annee));
  return imprimerRecuFamille(enfants, schoolInfo, moisAnnee, format === "a4" ? "a4" : Number(format));
}
