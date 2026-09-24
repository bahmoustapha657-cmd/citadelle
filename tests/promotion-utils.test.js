// Tests du parseur de classe suivante (promotion de fin d'année).
// Contrat : chaîne = classe suivante ; null = fin de cycle (Terminale) ;
// undefined = classe non reconnue (aucune écriture).
import { test } from "node:test";
import assert from "node:assert/strict";
import { classeSuivante, sectionApresPromotion } from "../src/promotion-utils.js";

test("Maternelle → 1ère Année (suffixe conservé)", () => {
  assert.equal(classeSuivante("Maternelle A"), "1ère Année A");
  assert.equal(classeSuivante("Maternelle B"), "1ère Année B");
  assert.equal(classeSuivante("Maternelle"), "1ère Année");
});

test("Progression primaire avec accents réels des constantes", () => {
  assert.equal(classeSuivante("1ère Année A"), "2ème Année A");
  assert.equal(classeSuivante("2ème Année B"), "3ème Année B");
  assert.equal(classeSuivante("5ème Année A"), "6ème Année A");
});

test("Passage primaire → collège (6ème → 7ème)", () => {
  assert.equal(classeSuivante("6ème Année A"), "7ème Année A");
  assert.equal(classeSuivante("6ème Année B"), "7ème Année B");
});

test("Collège guinéen 7ème → 10ème puis passage lycée", () => {
  assert.equal(classeSuivante("7ème Année A"), "8ème Année A");
  assert.equal(classeSuivante("9ème Année B"), "10ème Année B");
  assert.equal(classeSuivante("10ème Année A"), "11ème Année A");
});

test("Lycée : 11ème → 12ème → Terminale", () => {
  assert.equal(classeSuivante("11ème Année B"), "12ème Année B");
  assert.equal(classeSuivante("12ème Année A"), "Terminale A");
});

test("Terminale = fin de cycle (null)", () => {
  assert.equal(classeSuivante("Terminale A"), null);
  assert.equal(classeSuivante("Terminale"), null);
  assert.equal(classeSuivante("terminale b"), null);
});

test("Tolérance : ASCII legacy et casse", () => {
  assert.equal(classeSuivante("1ere Annee A"), "2ème Année A");
  assert.equal(classeSuivante("3eme annee"), "4ème Année");
  assert.equal(classeSuivante("MATERNELLE A"), "1ère Année A");
});

test("Suffixes personnalisés conservés tels quels", () => {
  assert.equal(classeSuivante("4ème Année Rouge"), "5ème Année Rouge");
  assert.equal(classeSuivante("8ème Année C"), "9ème Année C");
});

test("Système francophone : maternelle → primaire", () => {
  assert.equal(classeSuivante("Petite Section A"), "Moyenne Section A");
  assert.equal(classeSuivante("Moyenne Section B"), "Grande Section B");
  // Sortie de Grande Section : dépend du système de l'école (le préscolaire
  // emploie les mêmes niveaux dans les deux nomenclatures depuis 2026-07).
  assert.equal(classeSuivante("Grande Section", "francophone"), "CP");
  assert.equal(classeSuivante("Grande Section", "guineen"), "1ère Année");
  assert.equal(classeSuivante("Grande Section"), "1ère Année"); // défaut = guinéen
  assert.equal(classeSuivante("CP A"), "CE1 A");
  assert.equal(classeSuivante("CE1 B"), "CE2 B");
  assert.equal(classeSuivante("CE2 A"), "CM1 A");
  assert.equal(classeSuivante("CM1 C"), "CM2 C");
});

test("Système francophone : passage collège puis lycée", () => {
  assert.equal(classeSuivante("CM2 A"), "6ème A");
  assert.equal(classeSuivante("6ème A"), "5ème A");
  assert.equal(classeSuivante("5ème D"), "4ème D");
  assert.equal(classeSuivante("4ème B"), "3ème B");
  assert.equal(classeSuivante("3ème A"), "Seconde A");
  assert.equal(classeSuivante("Seconde A"), "Première A");
  assert.equal(classeSuivante("2nde C"), "Première C");
  assert.equal(classeSuivante("Première S"), "Terminale S");
  assert.equal(classeSuivante("1ère L"), "Terminale L");
});

test("Désambiguïsation : « Année » = guinéen, sans = francophone", () => {
  assert.equal(classeSuivante("1ère Année A"), "2ème Année A"); // primaire guinéen
  assert.equal(classeSuivante("1ère A"), "Terminale A");        // Première lycée
  assert.equal(classeSuivante("6ème Année A"), "7ème Année A"); // primaire→collège guinéen
  assert.equal(classeSuivante("6ème A"), "5ème A");             // collège francophone
});

test("Classes non reconnues → undefined (aucune écriture)", () => {
  assert.equal(classeSuivante(""), undefined);
  assert.equal(classeSuivante(null), undefined);
  assert.equal(classeSuivante("13ème Année A"), undefined);
  assert.equal(classeSuivante("0ème Année"), undefined);
  assert.equal(classeSuivante("Classe Spéciale"), undefined);
});

// Rangement de la fiche après promotion : changer la classe ne suffit pas,
// chaque module ne lit que SA section. Défaut constaté à La Citadelle : les
// Grande Section promus en « 1ère Année A » étaient restés au préscolaire.
const TOUTES = { sectionsActives: ["prescolaire", "primaire", "college", "lycee"] };

test("Promotion dans la même section : la fiche ne bouge pas", () => {
  assert.equal(sectionApresPromotion("Moyenne Section A", "prescolaire", TOUTES), "prescolaire");
  assert.equal(sectionApresPromotion("3ème Année A", "primaire", TOUTES), "primaire");
  assert.equal(sectionApresPromotion("9ème Année B", "college", TOUTES), "college");
});

test("Sortie de Grande Section : la fiche passe au primaire (deux systèmes)", () => {
  const guineen = classeSuivante("Grande Section A", "guineen");
  const francophone = classeSuivante("Grande Section A", "francophone");
  assert.equal(sectionApresPromotion(guineen, "prescolaire", TOUTES), "primaire");
  assert.equal(sectionApresPromotion(francophone, "prescolaire", TOUTES), "primaire");
});

test("Admis au CEE / BEPC : primaire → collège, collège → lycée", () => {
  assert.equal(sectionApresPromotion("7ème Année A", "primaire", TOUTES), "college");
  assert.equal(sectionApresPromotion("11ème Année A", "college", TOUTES), "lycee");
  assert.equal(sectionApresPromotion("6ème A", "primaire", TOUTES), "college");   // CM2 francophone
  assert.equal(sectionApresPromotion("Seconde A", "college", TOUTES), "lycee");   // 3ème francophone
});

test("Section d'arrivée fermée dans l'école : fin de cycle (null)", () => {
  // La Citadelle n'a pas de lycée : un admis au BEPC quitte l'école.
  const sansLycee = { sectionsActives: ["prescolaire", "primaire", "college"] };
  assert.equal(sectionApresPromotion("11ème Année A", "college", sansLycee), null);
  assert.equal(sectionApresPromotion("7ème Année A", "primaire", { sectionsActives: ["prescolaire", "primaire"] }), null);
  // Mais une promotion INTERNE à une section n'est jamais bloquée, même si
  // l'école a (mal) déclaré ses sections.
  assert.equal(sectionApresPromotion("8ème Année A", "college", { sectionsActives: ["primaire"] }), "college");
});

test("Réglage absent : toutes les sections sont ouvertes", () => {
  assert.equal(sectionApresPromotion("1ère Année A", "prescolaire", {}), "primaire");
  assert.equal(sectionApresPromotion("1ère Année A", "prescolaire", undefined), "primaire");
  assert.equal(sectionApresPromotion("1ère Année A", "prescolaire", null), "primaire");
});
