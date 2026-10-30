// Section choisie dans le formulaire « + Nouvel élève » / « Modifier
// l'élève », comme dans la saisie rapide. À la modification, changer la
// section fait passer l'élève dans l'autre section (passerelle manuelle,
// ex. Grande Section → 1ère Année) : la fiche change de classe ET de section
// dans la même requête (changerSectionDoc), jamais l'une sans l'autre.

import { changerSectionDoc } from "../../../backend/data-supabase";
import { getSectionForClasse, getSectionLabel } from "../../../constants";
import { MESSAGE_CLASSE_OBLIGATOIRE, classeManquante } from "../../../enrollment-utils";

export const COLLECTION_ELEVES = {
  prescolaire: "elevesPrescolaire", primaire: "elevesPrimaire", college: "elevesCollege", lycee: "elevesLycee",
};

// Contrôle avant enregistrement : la classe doit appartenir à la section
// choisie, sinon l'élève serait rangé dans une section qui ne l'affiche pas.
// Renvoie un message d'erreur, ou null.
export function erreurClasseSection(classe, section) {
  if (classeManquante({ classe })) return MESSAGE_CLASSE_OBLIGATOIRE;
  if (getSectionForClasse(classe) !== section) {
    return `« ${classe} » n'est pas une classe du ${getSectionLabel(section)}.`;
  }
  return null;
}

// Fait passer un élève existant de `depart` à `arrivee` avec sa nouvelle
// classe. Sur le SERVEUR : un refus (droits sur l'une des deux sections)
// y est visible ; hors ligne il passerait inaperçu jusqu'à la synchro.
export async function deplacerEleve(schoolId, eleveId, { depart, arrivee, classe }) {
  if (!COLLECTION_ELEVES[depart] || !COLLECTION_ELEVES[arrivee]) {
    throw new Error("Section inconnue.");
  }
  const erreur = erreurClasseSection(classe, arrivee);
  if (erreur) throw new Error(erreur);
  await changerSectionDoc(schoolId, COLLECTION_ELEVES[depart], eleveId, arrivee, { classe }, { reseau: true });
}
