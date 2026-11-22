import assert from "node:assert/strict";
import test from "node:test";
import {
  anneeAttesteePour, derniereAnneeAchevee, derniereClasseDeLEleve, derniereClassePourAttestation, derniereClasseSuivie,
  formatDerniereClasse,
} from "../src/reports/attestation/derniere-classe.js";
import { estCertificatDeNiveau, numeroAttestation } from "../src/reports/attestation.js";

// Élève de 9ème en 2026-2027, en 8ème l'an dernier (instantané de clôture).
const eleve = {
  _id: "el-1", nom: "DIALLO", prenom: "Aïssatou", matricule: "M-042", classe: "9ème A", statut: "Actif",
  historique: { "2025-2026": { classe: "8ème A", mens: {} } },
};

test("élève présent : la dernière classe suivie est celle de l'année précédente", () => {
  assert.deepEqual(derniereClasseSuivie(eleve, { anneeAttestee: "2026-2027" }), { classe: "8ème A", annee: "2025-2026" });
  assert.equal(derniereClassePourAttestation(eleve, "2026-2027"), "8ème A (2025-2026)");
});

test("élève venu d'ailleurs : la classe saisie à l'inscription, sans année", () => {
  const nouveau = { ...eleve, historique: {}, derniereClasse: " 8ème Année " };
  assert.equal(derniereClassePourAttestation(nouveau, "2026-2027"), "8ème Année");
  // L'instantané de clôture prime sur la saisie.
  assert.equal(derniereClassePourAttestation({ ...eleve, derniereClasse: "7ème" }, "2026-2027"), "8ème A (2025-2026)");
});

test("rien de connu : pas de ligne plutôt qu'une classe inventée", () => {
  assert.equal(derniereClasseSuivie({ ...eleve, historique: {} }, { anneeAttestee: "2026-2027" }), null);
  assert.equal(derniereClassePourAttestation({ ...eleve, historique: {} }, "2026-2027"), "");
  assert.equal(formatDerniereClasse(null), "");
});

// ── Élève parti : la dernière année ACHEVÉE, pas la classe du départ ──────
// Fait la 9ème en 2025-2026, promu en 10ème à la clôture.
const promu = {
  ...eleve, classe: "10ème A",
  historique: { "2024-2025": { classe: "8ème A" }, "2025-2026": { classe: "9ème A", clotureLe: "2026-07-02" } },
};

test("promu puis déclaré transféré : 9ème (2025-2026), pas la 10ème jamais achevée", () => {
  const parti = { ...promu, statut: "Transféré", dateDepart: "2026-11-10" };
  assert.equal(anneeAttesteePour(parti, "2026-2027"), "2026-2027");
  assert.equal(derniereAnneeAchevee(parti, "2026-2027"), "2025-2026");
  assert.equal(derniereClassePourAttestation(parti, "2026-2027"), "9ème A (2025-2026)");
  // Réimprimée l'année suivante, la pièce ne bouge pas.
  assert.equal(derniereClassePourAttestation(parti, "2027-2028"), "9ème A (2025-2026)");
  // Départ à la rentrée, avant le premier mois : même réponse.
  assert.equal(derniereClassePourAttestation({ ...parti, dateDepart: "2026-09-20" }, "2026-2027"), "9ème A (2025-2026)");
});

test("parti en cours d'année : la classe achevée l'année d'avant, comme un élève présent", () => {
  const parti = { ...promu, statut: "Transféré", dateDepart: "2026-02-10", classe: "9ème A" };
  assert.equal(anneeAttesteePour(parti, "2026-2027"), "2025-2026");
  assert.equal(derniereClassePourAttestation(parti, "2026-2027"), "8ème A (2024-2025)");
  // Aucune année achevée chez nous ni classe saisie : pas de ligne.
  assert.equal(derniereClassePourAttestation({ ...parti, historique: {} }, "2026-2027"), "");
});

test("parti au dernier mois de classe ou après : l'année de son départ est achevée", () => {
  // Diplômé du passage des admis : daté du dernier jour de l'année clôturée.
  const diplome = { ...promu, classe: "9ème A", statut: "Diplômé", dateDepart: "2026-06-30" };
  assert.equal(derniereClassePourAttestation(diplome, "2026-2027"), "9ème A (2025-2026)");
  // Parti pendant les vacances, avant la clôture : pas d'archive, pas de
  // promotion, sa classe du moment est celle qu'il vient d'achever.
  const vacances = { ...eleve, classe: "9ème A", historique: {}, statut: "Transféré", dateDepart: "2026-07-20" };
  assert.equal(derniereClassePourAttestation(vacances, "2026-2027"), "9ème A (2025-2026)");
  // Rentrée en septembre : le dernier mois est mai.
  const mai = { ...vacances, dateDepart: "2026-05-20" };
  assert.equal(derniereClassePourAttestation(mai, "2026-2027"), "");
  assert.equal(derniereClassePourAttestation(mai, "2026-2027", { moisDebut: "Septembre" }), "9ème A (2025-2026)");
});

test("parti sans date : jugé comme un élève présent, sur l'année de l'écran", () => {
  const sansDate = { ...promu, statut: "Abandonné" };
  assert.equal(derniereClassePourAttestation(sansDate, "2026-2027"), "9ème A (2025-2026)");
});

test("arrivé puis parti la même année : la classe saisie à son inscription", () => {
  const passage = { ...eleve, historique: {}, derniereClasse: "9ème Année", statut: "Transféré", dateDepart: "2026-12-01" };
  assert.equal(derniereClassePourAttestation(passage, "2026-2027"), "9ème Année");
  assert.deepEqual(derniereClasseDeLEleve(passage, "2026-2027"), { classe: "9ème Année", annee: "" });
});

test("au primaire, la pièce est un certificat de niveau (numéro CN-…)", () => {
  assert.equal(estCertificatDeNiveau("primaire"), true);
  assert.equal(estCertificatDeNiveau("prescolaire"), false);
  assert.equal(estCertificatDeNiveau("college"), false);
  const ecole = { nom: "La Citadelle" };
  assert.equal(numeroAttestation(eleve, ecole, "2026-2027", "CN"), "CN-LAC-26-M-042");
  assert.equal(numeroAttestation(eleve, ecole, "2026-2027"), "ATT-LAC-26-M-042");
});
