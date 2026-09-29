// Dérivations pures du portail parent : filtrage par enfant courant, calcul
// des tarifs et du blocage pour impayés, vue « famille ». Aucun état React.
import { estSorti, getTarifMensuelTotal } from "../../constants";
import { estExonereTotal } from "../../exoneration-utils";
import { getEleveSolde } from "../../mensualite-utils";
import { estAbsence, normalizeText } from "./helpers";
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

// Reste à payer d'un enfant sur l'année scolaire — mensualités, inscription,
// frais annexes, dispenses déduites : le chiffre « Reste à payer » de l'onglet
// Paiements (mêmes mois : ceux de l'année, sinon ceux de sa fiche).
export function resteAPayerEleve(eleve, moisAnnee, tarifs, annee) {
  const moisList = moisAnnee.length ? moisAnnee : Object.keys(eleve.mens || {});
  return getEleveSolde(eleve, moisList, tarifs, annee);
}

// Vue « famille » d'un parent de plusieurs enfants : une ligne par enfant
// (classe, absences, messages non lus, reste à payer, accès bloqué pour
// impayés) et le total à payer pour toute la famille.
export function resumeFamille({ eleves, absences, messages, tarifs, moisAnnee, annee, schoolInfo = {} }) {
  const enfants = eleves.map((eleve) => ({
    id: eleve._id,
    nom: `${eleve.prenom || ""} ${eleve.nom || ""}`.trim(),
    classe: eleve.classe || "",
    parti: estSorti(eleve),
    absences: absences.filter((a) => a.eleveId === eleve._id && estAbsence(a)).length,
    nonLus: messages.filter((m) => m.eleveId === eleve._id && m.expediteur === "ecole" && !m.lu).length,
    resteAPayer: resteAPayerEleve(eleve, moisAnnee, tarifs, annee),
    bloque: computeBlocage(schoolInfo, eleve, moisAnnee, annee).accesBloqueParPaiement,
  }));
  return {
    enfants,
    totalAPayer: enfants.reduce((total, e) => total + e.resteAPayer, 0),
    aJour: enfants.filter((e) => e.resteAPayer === 0).length,
  };
}
