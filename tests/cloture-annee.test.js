import assert from "node:assert/strict";
import test from "node:test";
import {
  champsArchivageClasse,
  champsCloture,
  scolaritePourAnnee,
} from "../src/components/admin/cloture-annee-utils.js";

const ANNEE = "2025-2026";

// Eleve de fin d'annee : scolarite encaissee, classe en cours.
const eleveType = () => ({
  classe: "4ème Année A",
  statut: "Actif",
  mens: { Octobre: "Payé", Novembre: "Payé" },
  inscriptionPayee: true,
  fraisPayes: { Tenue: 50000 },
});

test("cloture : archive la classe et remet la scolarite a zero", () => {
  const champs = champsCloture(eleveType(), ANNEE);
  assert.equal(champs.historique[ANNEE].classe, "4ème Année A");
  assert.ok(champs.historique[ANNEE].clotureLe, "l'instantane doit porter clotureLe");
  assert.equal(champs.inscriptionPayee, false);
  assert.deepEqual(champs.fraisPayes, {});
  assert.equal(champs.typeInscription, "Réinscription");
});

test("cloture : ne rejoue rien sur une annee DEJA CLOTUREE", () => {
  const eleve = { ...eleveType(), historique: { [ANNEE]: { classe: "4ème Année A", clotureLe: "2026-07-01T00:00:00.000Z" } } };
  assert.equal(champsCloture(eleve, ANNEE), null,
    "une seconde cloture effacerait les encaissements de l'annee neuve");
});

// LE PIEGE : promouvoir AVANT de cloturer. La promotion fige la classe
// (archiveLe) sans toucher aux compteurs. Si la cloture prenait cet instantane
// pour le sien, elle sauterait l'eleve et l'annee neuve demarrerait avec les
// paiements de l'ancienne.
test("cloture apres une promotion : garde la classe figee ET remet a zero", () => {
  const promu = {
    ...eleveType(),
    classe: "5ème Année A", // la promotion l'a deja deplace
    historique: { [ANNEE]: { classe: "4ème Année A", archiveLe: "2026-06-30T00:00:00.000Z" } },
  };
  const champs = champsCloture(promu, ANNEE);
  assert.ok(champs, "la cloture ne doit PAS sauter l'eleve");
  assert.equal(champs.historique[ANNEE].classe, "4ème Année A",
    "la classe de l'annee reste celle d'AVANT le deplacement");
  assert.ok(champs.historique[ANNEE].clotureLe);
  assert.equal(champs.historique[ANNEE].archiveLe, "2026-06-30T00:00:00.000Z",
    "la trace de la promotion est conservee");
  assert.equal(champs.inscriptionPayee, false, "les compteurs doivent bien repartir a zero");
  assert.deepEqual(champs.fraisPayes, {});
});

test("archivage de promotion : fige la classe sans toucher aux paiements", () => {
  const champs = champsArchivageClasse(eleveType(), ANNEE);
  assert.equal(champs.historique[ANNEE].classe, "4ème Année A");
  assert.ok(champs.historique[ANNEE].archiveLe);
  assert.equal(champs.inscriptionPayee, undefined, "la promotion ne remet aucun compteur a zero");
  assert.equal(champs.mens, undefined);
});

test("archivage de promotion : n'ecrase jamais un instantane existant", () => {
  const deja = { ...eleveType(), historique: { [ANNEE]: { classe: "3ème Année A", clotureLe: "x" } } };
  assert.equal(champsArchivageClasse(deja, ANNEE), null);
  assert.equal(champsArchivageClasse(eleveType(), ""), null, "sans annee, on ne fige rien");
});

test("lecture d'une annee passee : la classe archivee prime", () => {
  const eleve = {
    classe: "5ème Année A",
    historique: { [ANNEE]: { classe: "4ème Année A", clotureLe: "x" } },
  };
  assert.equal(scolaritePourAnnee(eleve, ANNEE, "2026-2027").classe, "4ème Année A");
  // Annee courante : c'est la fiche vivante qui fait foi.
  assert.equal(scolaritePourAnnee(eleve, "2026-2027", "2026-2027").classe, "5ème Année A");
});
