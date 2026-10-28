// Petits helpers partagés par Comptabilite.jsx et ses sous-tabs.
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.
import { trierElevesAlpha } from "../../ordre-eleves.js";

// Tri alphabétique des élèves selon la préférence schoolInfo.triEleves
// ("prenom_nom" | "nom_prenom" | "classe_prenom" | "classe_nom").
export function sortAlphaEleves(arr, triEleves) {
  return trierElevesAlpha(arr, triEleves);
}

// Crée la classe dans Firestore si elle n'existe pas encore. Le caller
// passe (classesList, ajClasse) selon le niveau pour rester découplé.
// `dejaCreees` est un Set partagé entre appels successifs pour éviter
// les doublons quand la même classe apparait plusieurs fois dans un import.
export async function ensureClasse(nom, { classesList, ajClasse, dejaCreees }) {
  if(!nom) return;
  if(!classesList.find(c=>c.nom===nom) && !(dejaCreees&&dejaCreees.has(nom))) {
    await ajClasse({nom, effectif:0});
    if(dejaCreees) dejaCreees.add(nom);
  }
}
