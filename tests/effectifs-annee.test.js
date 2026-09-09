import assert from "node:assert/strict";
import test from "node:test";
import { classePourAnnee } from "../src/components/admin/cloture-annee-utils.js";
import { effectifReel } from "../src/components/ecole/ecole-logic.js";

// « La classe de l'eleve » n'a pas la meme reponse selon la question posee.
// useEcole tient donc DEUX listes :
//   eleves       -> classe REELLE, pour la gestion (effectifs, filtres, notes)
//   elevesAnnee  -> classe de l'ANNEE CONSULTEE, pour les resultats (palmares)
// Ce fichier verrouille la separation : la projection avait ete appliquee a la
// liste partagee, et les effectifs par classe s'en trouvaient fausses.

const ANNEE = "2025-2026";

// Ecole ayant CLOTURE puis PROMU, avec un nouvel inscrit arrive apres coup :
// trois promus de 3eme, un redoublant deja en 4eme, un entrant sans instantane.
const fiches = [
  { nom: "A", classe: "4ème Année A", statut: "Actif", historique: { [ANNEE]: { classe: "3ème Année A" } } },
  { nom: "B", classe: "4ème Année A", statut: "Actif", historique: { [ANNEE]: { classe: "3ème Année A" } } },
  { nom: "C", classe: "4ème Année A", statut: "Actif", historique: { [ANNEE]: { classe: "3ème Année A" } } },
  { nom: "D", classe: "4ème Année A", statut: "Actif", historique: { [ANNEE]: { classe: "4ème Année A" } } },
  { nom: "E", classe: "4ème Année A", statut: "Actif" },
];

// Reproduit exactement le `elevesAnnee` de useEcole.
const projeter = (liste, annee) => liste.map((e) => {
  const classe = classePourAnnee(e, annee);
  return classe === e.classe ? e : { ...e, classe };
});

test("effectifs : la gestion compte la classe REELLE", () => {
  assert.equal(effectifReel(fiches, "4ème Année A"), 5);
  assert.equal(effectifReel(fiches, "3ème Année A"), 0);
});

test("la projection appliquee aux effectifs melangeait deux populations", () => {
  // Le defaut corrige : quand la liste projetee servait AUSSI aux effectifs,
  // les promus repartaient en 3eme tandis que le redoublant et le nouvel
  // inscrit restaient en 4eme. Les effectifs n'etaient pas decales d'un cran,
  // ils comptaient deux populations differentes dans la meme liste.
  const projetee = projeter(fiches, ANNEE);
  assert.equal(effectifReel(projetee, "4ème Année A"), 2, "la 4eme perdait 3 eleves");
  assert.equal(effectifReel(projetee, "3ème Année A"), 3, "la 3eme comptait des eleves partis");
});

test("resultats : le palmares nomme la classe de l ANNEE consultee", () => {
  const annee = projeter(fiches, ANNEE);
  assert.equal(annee.find((e) => e.nom === "A").classe, "3ème Année A");
  assert.equal(annee.find((e) => e.nom === "D").classe, "4ème Année A", "le redoublant y etait deja");
  // Sans instantane, la fiche fait foi : on n'invente pas une classe passee.
  assert.equal(annee.find((e) => e.nom === "E").classe, "4ème Année A");
});

test("annee sans instantane : les deux listes coincident", () => {
  const suivante = projeter(fiches, "2026-2027");
  assert.deepEqual(suivante.map((e) => e.classe), fiches.map((e) => e.classe));
  assert.equal(effectifReel(suivante, "4ème Année A"), 5);
});
