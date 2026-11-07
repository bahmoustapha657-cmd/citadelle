// Suppression d'une fiche élève — logique pure (aucun accès réseau).
//
// Supprimer une fiche effaçait, par cascade, TOUTES ses lignes du journal de
// caisse : l'argent encaissé disparaissait et les bilans changeaient après
// coup (8 615 000 GNF perdus ainsi, mesuré le 2026-10-09). Une fiche qui porte
// de l'argent ne se supprime donc plus : l'élève qui s'en va se déclare PARTI.
//
// La base applique la même règle (migration eleves_suppression_encaissements,
// hint « eleve_avec_encaissements ») et voit, elle, le journal de TOUTES les
// années ; l'écran ne connaît que celui de l'année chargée, d'où le message
// d'erreur traduit plus bas.

// Extension explicite : module couvert par des tests Node.
import { aDesPaiements } from "../../../depart-utils.js";
import i18n from "../../../i18n/index.js";

export const INDICE_REFUS_ENCAISSEMENTS = "eleve_avec_encaissements";
const VIOLATION_CLE_ETRANGERE = "23503"; // filet SQL (paiements_eleve_id_fkey)

// L'élève porte-t-il de l'argent ? Une ligne au journal de caisse, un
// encaissement sur sa fiche, ou dans l'archive d'une année close — la caisse
// lit ces deux derniers quand le journal ne connaît pas le paiement.
export function porteDesEncaissements(eleve = {}, paiements = []) {
  if (eleve._id && paiements.some((p) => p.eleveId === eleve._id)) return true;
  if (aDesPaiements(eleve)) return true;
  return Object.values(eleve.historique || {}).some((archive) => !!archive && aDesPaiements(archive));
}

const nomComplet = (eleve = {}) => `${eleve.nom || ""} ${eleve.prenom || ""}`.trim()
  || i18n.t("enrolment.deletionUnnamed");

// Refus : la question propose directement le bon geste.
export function messageSuppressionRefusee(eleve) {
  return i18n.t("enrolment.deletionRefused", { name: nomComplet(eleve) });
}

export function messageConfirmationSuppression(eleve) {
  return i18n.t("enrolment.deletionConfirm", { name: nomComplet(eleve) });
}

export function estRefusEncaissements(erreur) {
  return erreur?.hint === INDICE_REFUS_ENCAISSEMENTS || erreur?.code === VIOLATION_CLE_ETRANGERE;
}

// Refus du serveur traduit pour l'écran ; toute autre erreur reste visible
// telle quelle (jamais de « supprimé » sur un échec).
export function messageErreurSuppression(erreur, eleve) {
  if (estRefusEncaissements(erreur)) {
    return i18n.t("enrolment.deletionRefusedServer", { name: nomComplet(eleve) });
  }
  return i18n.t("enrolment.deletionFailed", { message: erreur?.message || erreur });
}
