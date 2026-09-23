// Fenêtre « Nouveau bon » : quels agents proposer pour une section de paie.
// Régression à l'origine de ces tests : la liste venait des fiches de paie DÉJÀ
// générées pour le mois. À la rentrée 2026-2027 (aucune paie encore générée),
// elle restait vide pour toutes les sections — il fallait générer la paie d'un
// mois pour pouvoir y saisir une avance.
import test from "node:test";
import assert from "node:assert/strict";
import { agentsPourBon, sectionDuBon } from "../src/components/comptabilite/salaires/bon-agents.js";
import {
  buildPersonnelSalaryRecord, buildPrimarySalaryRecord, buildSecondarySalaryRecord, findBonsForSalary,
} from "../src/salary-utils.js";

const LISTES = {
  ensCollege: [{ prenom: "Aminata", nom: "Diallo" }, { prenom: "Ibrahima", nom: "Sow" }],
  // Même enseignante au collège et au lycée : une seule entrée attendue.
  ensLycee: [{ prenom: "Aminata", nom: "Diallo" }, { prenom: "Fanta", nom: "Camara" }],
  ensPrimaire: [{ prenom: "Mamadou", nom: "Bah" }],
  personnel: [
    { prenom: "Kadiatou", nom: "Barry", statut: "Actif" },
    { prenom: "Ousmane", nom: "Keita" }, // sans statut : actif par défaut
    { prenom: "Alpha", nom: "Condé", statut: "Inactif" },
  ],
};

test("sans aucune fiche de paie, chaque section propose ses agents en fiche", () => {
  assert.deepEqual(agentsPourBon("Secondaire", LISTES), ["Aminata Diallo", "Fanta Camara", "Ibrahima Sow"]);
  assert.deepEqual(agentsPourBon("Primaire", LISTES), ["Mamadou Bah"]);
  // Personnel : les actifs seulement, comme la génération de paie.
  assert.deepEqual(agentsPourBon("Personnel", LISTES), ["Kadiatou Barry", "Ousmane Keita"]);
  assert.deepEqual(agentsPourBon("Inconnue", LISTES), []);
  assert.deepEqual(agentsPourBon("Primaire", {}), []);
});

test("un bon saisi depuis la liste s'applique à la fiche que la génération créera", () => {
  // C'est tout l'enjeu du nom : « Appliquer les bons » apparie nom normalisé +
  // mois + section. La liste doit donc produire le nom des fiches de paie.
  const cas = [
    ["Secondaire", buildSecondarySalaryRecord(LISTES.ensCollege[1], { mois: "Octobre" })],
    ["Primaire", buildPrimarySalaryRecord(LISTES.ensPrimaire[0], { mois: "Octobre" })],
    ["Personnel", buildPersonnelSalaryRecord(LISTES.personnel[0], { mois: "Octobre" })],
  ];
  for (const [section, fiche] of cas) {
    const nom = agentsPourBon(section, LISTES).find((n) => n === fiche.nom);
    assert.ok(nom, `${section} : « ${fiche.nom} » absent de la liste`);
    const bon = { nom, section, mois: "Octobre", montant: 50000 };
    assert.deepEqual(findBonsForSalary(fiche, [bon]), [bon], `${section} : bon non appliqué`);
  }
});

test("en modification, le nom du bon reste affiché même si l'agent a quitté les fiches", () => {
  assert.deepEqual(agentsPourBon("Primaire", LISTES, "Saliou Sylla"), ["Mamadou Bah", "Saliou Sylla"]);
  // Déjà présent (casse ou accents près) : pas de doublon.
  assert.deepEqual(agentsPourBon("Primaire", LISTES, "MAMADOU  bah"), ["Mamadou Bah"]);
});

test("sectionDuBon retrouve la section d'un bon repris de l'ancienne base", () => {
  assert.equal(sectionDuBon("Ibrahima Sow", LISTES), "Secondaire");
  assert.equal(sectionDuBon("mamadou bah", LISTES), "Primaire");
  assert.equal(sectionDuBon("Ousmane Keita", LISTES), "Personnel");
  // Inconnu, vide, ou présent dans deux sections (prof et administratif) : on ne devine pas.
  assert.equal(sectionDuBon("Personne Inconnue", LISTES), null);
  assert.equal(sectionDuBon("", LISTES), null);
  const doubleCasquette = { ...LISTES, personnel: [...LISTES.personnel, { prenom: "Mamadou", nom: "Bah" }] };
  assert.equal(sectionDuBon("Mamadou Bah", doubleCasquette), null);
});
