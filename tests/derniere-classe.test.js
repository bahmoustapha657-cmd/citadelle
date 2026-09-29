import assert from "node:assert/strict";
import test from "node:test";
import {
  anneeAttesteePour, derniereClassePourAttestation, derniereClasseSuivie, formatDerniereClasse,
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

test("élève parti : la classe qu'il suivait, sous l'année de son départ", () => {
  const parti = { ...eleve, statut: "Transféré", dateDepart: "2026-02-10", classe: "8ème A" };
  assert.equal(anneeAttesteePour(parti, "2026-2027"), "2025-2026");
  assert.equal(derniereClassePourAttestation(parti, "2026-2027"), "8ème A (2025-2026)");
});

test("au primaire, la pièce est un certificat de niveau (numéro CN-…)", () => {
  assert.equal(estCertificatDeNiveau("primaire"), true);
  assert.equal(estCertificatDeNiveau("prescolaire"), false);
  assert.equal(estCertificatDeNiveau("college"), false);
  const ecole = { nom: "La Citadelle" };
  assert.equal(numeroAttestation(eleve, ecole, "2026-2027", "CN"), "CN-LAC-26-M-042");
  assert.equal(numeroAttestation(eleve, ecole, "2026-2027"), "ATT-LAC-26-M-042");
});
