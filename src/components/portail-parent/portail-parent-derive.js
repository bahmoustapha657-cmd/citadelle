// Dérivations pures du portail parent : filtrage par enfant courant, calcul
// des tarifs et du blocage pour impayés. Aucun état React.
import { getTarifMensuelTotal } from "../../constants";
import { estExonereTotal } from "../../exoneration-utils";
import { normalizeText } from "./helpers";
import { moisExigibles } from "../../depart-utils";

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

// Montants (mensualité, inscription/réinscription) pour l'enfant. Les frais
// annexes (révision, cantine…) se lisent dans le tarif de la classe, cf.
// PaiementsTab.
export function computeTarifInfos(tarifs, eleve) {
  const tarifEleve = tarifs.find((item) => item.classe === eleve.classe) || null;
  const montantMensuel = getTarifMensuelTotal(tarifEleve, eleve.classe);
  const estReinscription = normalizeText(eleve.typeInscription) === "reinscription";
  const montantInscription = estReinscription
    ? Number(tarifEleve?.reinscription || 0)
    : Number(tarifEleve?.inscription || 0);
  return { montantMensuel, estReinscription, montantInscription };
}

// Mois impayés et accès bloqué si l'option de blocage est active.
// Un élève dispensé de la mensualité ne doit rien : aucun mois impayé à
// annoncer à sa famille, et aucun accès retenu. Un élève parti ne doit que
// les mois entamés avant son départ (`annee` : celle des fiches).
export function computeBlocage(schoolInfo, eleve, moisAnnee, annee) {
  if (estExonereTotal(eleve, "mensualites")) return { moisImpayes: [], accesBloqueParPaiement: false };
  const blocageActif = !!schoolInfo.blocageParentImpaye;
  const moisImpayes = moisExigibles(eleve, moisAnnee, annee)
    .filter((mois) => normalizeText((eleve.mens || {})[mois]) !== "paye");
  const accesBloqueParPaiement = blocageActif && moisImpayes.length > 0;
  return { moisImpayes, accesBloqueParPaiement };
}
