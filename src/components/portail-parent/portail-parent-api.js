// Accès données du portail parent : chargement des données et envoi d'un
// message. Normalisent les réponses ou lèvent une erreur.
import * as sbParent from "../../backend/parent-portal-supabase";

// Charge les données du portail et renvoie un portalData normalisé (tableaux).
// `opts.annee` : année des notes.
export function fetchParentPortal(opts = {}) {
  return sbParent.fetchParentPortal(opts);
}

// Envoie un message au nom du parent pour l'élève courant.
export function envoyerMessageParent({ eleveId, sujet, corps }) {
  return sbParent.envoyerMessageParent({ eleveId, sujet, corps });
}
