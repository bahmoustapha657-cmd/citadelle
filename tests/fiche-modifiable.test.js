// « Modifier l'élève » et le renommage d'une classe ne renvoient plus la
// fiche entière : un encaissement fait entre-temps sur un autre poste était
// effacé (le jsonb `extra` réécrit en entier depuis la mémoire de l'écran).
import test from "node:test";
import assert from "node:assert/strict";
import { champsFicheModifiee } from "../src/components/comptabilite/enrolment/fiche-modifiable.js";
import { saveClasseAction } from "../src/components/ecole/ecole-saves.js";
import { toRow } from "../src/backend/collection-map.js";

test("modifier l'élève : les paiements et archives ne partent pas, le reste oui", () => {
  const fiche = {
    _id: "e1", nom: "BAH", prenom: "Awa", classe: "7ème A", statut: "Actif", tuteur: "M. Bah",
    typeInscription: "Réinscription", interruptions: [{ depart: "2026-11-02", retour: "2026-12-01" }],
    mens: { Octobre: "Impayé" }, mensDates: {}, mensMontants: {}, mensAcomptes: {},
    fraisPayes: {}, inscriptionPayee: false, exoneration: null,
    historique: { "2025-2026": { classe: "6ème A" } },
  };
  const champs = champsFicheModifiee(fiche);
  assert.deepEqual(Object.keys(champs).sort(), [
    "classe", "interruptions", "nom", "prenom", "statut", "tuteur", "typeInscription",
  ]);
  // Aucun champ de paiement dans le jsonb envoyé : la fusion (modifierChampDoc)
  // garde ceux de la base, même s'ils ont changé depuis l'ouverture.
  const { extraKeys } = toRow("eleves", champs);
  assert.deepEqual(extraKeys.sort(), ["interruptions", "typeInscription"]);
});

test("renommer une classe : seule la classe des élèves est écrite", () => {
  const ecrits = [];
  saveClasseAction({
    form: { _id: "c1", nom: "7ème B", effectif: "2" },
    modal: "edit_c",
    classes: [{ _id: "c1", nom: "7ème A" }],
    eleves: [
      { _id: "e1", classe: "7ème A", mens: { Octobre: "Impayé" } },
      { _id: "e2", classe: "8ème A", mens: {} },
    ],
    ajC: () => {},
    modC: () => {},
    modChampE: (id, champs) => ecrits.push([id, champs]),
  });
  assert.deepEqual(ecrits, [["e1", { classe: "7ème B" }]]);
});
