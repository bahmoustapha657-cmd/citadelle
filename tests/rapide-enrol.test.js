// Saisie rapide (fratrie / même tuteur) : chaque élève est inscrit dans SA
// section. Avant, la modale restait enfermée dans la section de la barre
// d'outils : impossible d'y inscrire l'aîné au collège et le cadet au
// primaire sans tout ressaisir.
import test from "node:test";
import assert from "node:assert/strict";
import {
  changerSectionFormulaire, eleveVide, formulaireEleveSuivant, matriculeSaisieRapide, sectionsSaisieRapide,
} from "../src/components/comptabilite/enrolment/rapide-enrol.js";

// genererMatricule lit l'année scolaire dans localStorage.
const avecAnnee = (fn) => () => {
  const precedent = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => "2025-2026" };
  try { fn(); } finally { globalThis.localStorage = precedent; }
};

test("sections proposées : celles ouvertes dans l'école, dans l'ordre des cycles", () => {
  assert.deepEqual(sectionsSaisieRapide({}), ["prescolaire", "primaire", "college", "lycee"]);
  // Ordre des cycles quel que soit l'ordre enregistré dans les réglages.
  assert.deepEqual(sectionsSaisieRapide({ sectionsActives: ["college", "primaire"] }), ["primaire", "college"]);
  assert.deepEqual(sectionsSaisieRapide({ sectionsActives: ["lycee"] }), ["lycee"]);
});

test("matricule : préfixe de la section choisie, pas de celle de la barre d'outils", avecAnnee(() => {
  const elevesParNiveau = {
    college: [{ matricule: "C25-004" }],
    primaire: [{ matricule: "P25-011" }],
  };
  assert.equal(matriculeSaisieRapide("college", { elevesParNiveau }), "C25-005");
  assert.equal(matriculeSaisieRapide("primaire", { elevesParNiveau }), "P25-012");
  assert.equal(matriculeSaisieRapide("lycee", { elevesParNiveau }), "L25-001");
}));

test("matricule : les élèves de la saisie en cours comptent, section par section", avecAnnee(() => {
  const elevesParNiveau = { college: [{ matricule: "C25-004" }], primaire: [] };
  // La liste chargée n'a pas encore été rechargée après les ajouts.
  const ajoutes = [
    { niveau: "college", matricule: "C25-005" },
    { niveau: "primaire", matricule: "P25-001" },
  ];
  assert.equal(matriculeSaisieRapide("college", { elevesParNiveau, ajoutes }), "C25-006");
  assert.equal(matriculeSaisieRapide("primaire", { elevesParNiveau, ajoutes }), "P25-002");
  // Liste rechargée entre-temps : aucun double comptage (on prend le maximum).
  const recharges = { college: [{ matricule: "C25-004" }, { matricule: "C25-005" }], primaire: [{ matricule: "P25-001" }] };
  assert.equal(matriculeSaisieRapide("college", { elevesParNiveau: recharges, ajoutes }), "C25-006");
}));

test("matricule : réglages de l'école respectés (préfixes personnalisés)", avecAnnee(() => {
  const schoolInfo = { matriculePrefixPrim: "PRI", matriculeSep: "/" };
  assert.equal(matriculeSaisieRapide("primaire", { schoolInfo }), "PRI25/001");
}));

test("élève suivant : fratrie et section conservées, fiche de l'élève remise à zéro", () => {
  const precedent = {
    tuteur: "Bah Mamadou", contactTuteur: "622 00 00 00", filiation: "Père : Bah", domicile: "Kaloum",
    dateArrivee: "2025-10-01",
    nom: "Bah", prenom: "Aminata", classe: "7ème Année A", niveau: "college", sexe: "F",
    dateNaissance: "2012-03-04", photo: "https://exemple/photo.jpg", matricule: "C25-005",
    typeInscription: "Réinscription",
  };
  const suivant = formulaireEleveSuivant(precedent, "college", "C25-006");
  assert.equal(suivant.tuteur, "Bah Mamadou");
  assert.equal(suivant.contactTuteur, "622 00 00 00");
  assert.equal(suivant.filiation, "Père : Bah");
  assert.equal(suivant.domicile, "Kaloum");
  assert.equal(suivant.dateArrivee, "2025-10-01");
  assert.equal(suivant.niveau, "college");
  assert.equal(suivant.matricule, "C25-006");
  assert.equal(suivant.statut, "Actif");
  assert.equal(suivant.sexe, "M");
  assert.equal(suivant.typeInscription, "Première inscription");
  for (const champ of ["nom", "prenom", "classe", "dateNaissance", "photo"]) {
    assert.equal(suivant[champ], undefined, `${champ} doit repartir à vide`);
  }
});

test("changement de section : classe vidée, matricule recalculé, reste de la fiche intact", () => {
  const form = { nom: "Bah", prenom: "Ibrahima", tuteur: "Bah Mamadou", classe: "7ème Année A", niveau: "college", matricule: "C25-006" };
  const change = changerSectionFormulaire(form, "primaire", "P25-002");
  assert.deepEqual(change, {
    nom: "Bah", prenom: "Ibrahima", tuteur: "Bah Mamadou", classe: "", niveau: "primaire", matricule: "P25-002",
  });
});

test("fiche vide : « Terminer » après « Élève suivant » ne réclame pas de nom", () => {
  assert.equal(eleveVide({ tuteur: "Bah Mamadou", niveau: "college", matricule: "C25-006", sexe: "M" }), true);
  assert.equal(eleveVide({ nom: "  " }), true);
  assert.equal(eleveVide({ nom: "Bah" }), false);
  assert.equal(eleveVide({ classe: "CM1 A" }), false);
  assert.equal(eleveVide({ photo: "data:image/jpeg;base64,xx" }), false);
});
