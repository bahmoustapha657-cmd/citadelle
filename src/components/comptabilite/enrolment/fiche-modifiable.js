// Champs qu'envoie « Modifier l'élève » : la fiche du formulaire, SANS ce que
// d'autres écrans tiennent à jour pendant qu'elle est ouverte.
//
// Le formulaire part d'une copie de la fiche prise à l'ouverture. La renvoyer
// en entier (modifierDoc réécrit tout le jsonb `extra`) effaçait ce qui avait
// changé entre-temps : un mois encaissé par un autre poste pendant que la
// fenêtre était ouverte disparaissait à l'enregistrement. Ces champs ne sont
// pas modifiables dans le formulaire : ils restent tels que la base les a, et
// le reste est fusionné champ par champ (modifierChampDoc).
//
// Logique pure : testable sous Node.
import { CHAMPS_SCOLARITE } from "../../admin/cloture-annee-utils.js";

// Le type d'inscription, lui, se choisit dans le formulaire.
export const CHAMPS_HORS_FORMULAIRE = new Set([
  ...CHAMPS_SCOLARITE.filter((c) => c !== "typeInscription"),
  // Archives des années clôturées (cloture-annee-utils).
  "historique",
]);

// `{ _id, ...champs }` → champs à fusionner dans la fiche.
export function champsFicheModifiee(fiche = {}) {
  const champs = {};
  for (const [cle, val] of Object.entries(fiche)) {
    if (cle === "_id" || CHAMPS_HORS_FORMULAIRE.has(cle)) continue;
    champs[cle] = val;
  }
  return champs;
}
