// Dérivations pures du portail parent : filtrage par enfant courant, calcul
// des tarifs et du blocage pour impayés. Aucun état React.
import { getTarifAutreValue, getTarifMensuelTotal } from "../../constants";
import { normalizeText } from "./helpers";

// Notes de l'enfant courant.
export const filtrerNotes = (notes, eleveId) =>
  notes.filter((item) => item.eleveId === eleveId);

// Absences de l'enfant courant.
export const filtrerAbsences = (absences, eleveId) =>
  absences.filter((item) => item.eleveId === eleveId);

// Messages de l'enfant courant, triés du plus récent au plus ancien.
export const trierMessages = (messages, eleveId) =>
  [...messages]
    .filter((item) => item.eleveId === eleveId)
    .sort((left, right) => Number(right.date || 0) - Number(left.date || 0));

// Montants (mensualité, autres frais, inscription/réinscription) pour l'enfant.
export function computeTarifInfos(tarifs, eleve) {
  const tarifEleve = tarifs.find((item) => item.classe === eleve.classe) || null;
  const montantMensuel = getTarifMensuelTotal(tarifEleve, eleve.classe);
  const montantAutre = getTarifAutreValue(tarifEleve);
  const estReinscription = normalizeText(eleve.typeInscription) === "reinscription";
  const montantInscription = estReinscription
    ? Number(tarifEleve?.reinscription || 0)
    : Number(tarifEleve?.inscription || 0);
  return { montantMensuel, montantAutre, estReinscription, montantInscription };
}

// Mois impayés et accès bloqué si l'option de blocage est active.
export function computeBlocage(schoolInfo, eleve, moisAnnee) {
  const blocageActif = !!schoolInfo.blocageParentImpaye;
  const moisImpayes = moisAnnee.filter((mois) => normalizeText((eleve.mens || {})[mois]) !== "paye");
  const accesBloqueParPaiement = blocageActif && moisImpayes.length > 0;
  return { moisImpayes, accesBloqueParPaiement };
}
