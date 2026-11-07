// ══════════════════════════════════════════════════════════════
//  Ordre des noms d'élèves (Paramètres → Affichage, schoolInfo.triEleves)
// ══════════════════════════════════════════════════════════════
// Un seul réglage pour deux choses qui doivent aller ensemble : la façon
// d'écrire le nom dans les listes (« Prénom NOM » ou « NOM Prénom ») et
// l'ordre alphabétique. Les listes écrivaient toujours « NOM Prénom » alors
// que le défaut triait sur le prénom : DIALLO Abdoulaye passait avant
// BAH Mariama, et la liste semblait en désordre quel que soit le réglage.
//
// Seul l'AFFICHAGE suit ce réglage : le nom enregistré avec une note, un
// paiement ou dans le journal reste « NOM Prénom » (nomEleve, fiche-eleve.js).

import { comparerClassesParNiveau } from "./constants.js";

export const TRIS_ELEVES = ["prenom_nom", "nom_prenom", "classe_prenom", "classe_nom"];
// École qui n'a jamais réglé l'ordre : « NOM Prénom », comme les documents
// imprimés — l'écriture qu'elle avait déjà, désormais avec l'ordre assorti.
export const TRI_ELEVES_DEFAUT = "nom_prenom";

export const lireTriEleves = (tri) => (TRIS_ELEVES.includes(tri) ? tri : TRI_ELEVES_DEFAUT);

const prenomDAbord = (tri) => ["prenom_nom", "classe_prenom"].includes(lireTriEleves(tri));
const parClasse = (tri) => lireTriEleves(tri).startsWith("classe_");

const champs = (eleve = {}, tri) => {
  const nom = String(eleve.nom || "").trim();
  const prenom = String(eleve.prenom || "").trim();
  return prenomDAbord(tri) ? [prenom, nom] : [nom, prenom];
};

// Nom tel qu'il s'écrit dans les listes de l'école.
export const nomAffiche = (eleve, tri) => champs(eleve, tri).filter(Boolean).join(" ");

const comparerTexte = (a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });

// Ordre alphabétique de l'école : classe (dans l'ordre des niveaux) si le
// réglage le demande, puis le premier mot écrit, puis le second.
export function trierElevesAlpha(eleves = [], tri) {
  return [...eleves].sort((a, b) => {
    if (parClasse(tri)) {
      const parNiveau = comparerClassesParNiveau(a.classe, b.classe);
      if (parNiveau) return parNiveau;
    }
    const [a1, a2] = champs(a, tri);
    const [b1, b2] = champs(b, tri);
    return comparerTexte(a1, b1) || comparerTexte(a2, b2);
  });
}
