import assert from "node:assert/strict";
import test from "node:test";

import {
  classesAccueil, dossierTransfert, etatTransfert, finValidite, normaliserToken, transfertDeLEleve,
} from "../src/components/transferts/dossier-transfert.js";
import { situationAuDepart } from "../src/components/transferts/situation-depart.js";

const MOIS = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun"];
const impayes = () => Object.fromEntries(MOIS.map((m) => [m, "Impayé"]));
const tarifs = [
  { classe: "4ème Année A", montant: 100000, reinscription: 30000 },
  { classe: "5ème Année A", montant: 120000, reinscription: 40000 },
];

test("dossierTransfert n'emporte que l'identité, jamais la scolarité", () => {
  const eleve = {
    _id: "e1", section: "primaire", nom: "Bah", prenom: "Aïssatou", sexe: "F", matricule: "P25-004",
    classe: "5ème Année A", dateNaissance: "2015-03-02", tuteur: "Mamadou Bah", contactTuteur: "620000000",
    statut: "Transféré", dateDepart: "2026-09-15", motifDepart: "Déménagement",
    mens: { Oct: "Payé" }, inscriptionPayee: true, exoneration: { mensualites: 100 },
    historique: { "2025-2026": { classe: "4ème Année A" } }, ien: "",
  };
  const dossier = dossierTransfert(eleve, { schoolNom: "GS La Citadelle", solde: 90000 });
  assert.deepEqual(Object.keys(dossier).sort(), [
    "_id", "classe", "contactTuteur", "dateNaissance", "matricule", "nom", "prenom",
    "schoolNom", "section", "sexe", "solde", "tuteur",
  ]);
  assert.equal(dossier.solde, 90000);
  for (const cle of ["statut", "dateDepart", "mens", "inscriptionPayee", "exoneration", "historique"]) {
    assert.equal(cle in dossier, false, `${cle} ne doit pas partir chez l'école d'accueil`);
  }
});

test("état d'un token : en attente, expiré après 30 jours, accepté", () => {
  const maintenant = Date.parse("2026-10-20T12:00:00Z");
  assert.equal(etatTransfert(null, maintenant), null);
  assert.equal(etatTransfert({ statut: "en_attente", createdAt: "2026-10-01T08:00:00Z" }, maintenant), "en_attente");
  assert.equal(etatTransfert({ statut: "en_attente", createdAt: "2026-09-10T08:00:00Z" }, maintenant), "expire");
  assert.equal(etatTransfert({ statut: "accepte", createdAt: "2026-09-10T08:00:00Z" }, maintenant), "accepte");
  assert.equal(finValidite({ createdAt: "2026-10-01T08:00:00Z" }).toISOString(), "2026-10-31T08:00:00.000Z");

  const liste = [{ eleveId: "e1", token: "recent" }, { eleveId: "e1", token: "ancien" }];
  assert.equal(transfertDeLEleve(liste, "e1").token, "recent");
  assert.equal(transfertDeLEleve(liste, "e2"), null);
});

test("normaliserToken accepte un code collé avec espaces ou majuscules", () => {
  const token = "3f2a9c1e-7b4d-4e0a-9c1b-2d3e4f5a6b7c";
  assert.equal(normaliserToken(`  ${token.toUpperCase()}\n`), token);
  assert.equal(normaliserToken("3f2a9c1e 7b4d-4e0a-9c1b-2d3e4f5a6b7c"), "");
  assert.equal(normaliserToken("TRF-A3K9B2"), "");
});

test("classesAccueil : classes déjà utilisées d'abord, puis la liste type, sans doublon", () => {
  assert.deepEqual(
    classesAccueil(["5ème Année E", "5ème Année A"], ["5ème Année A", "5ème Année B"]),
    ["5ème Année E", "5ème Année A", "5ème Année B"],
  );
});

test("situationAuDepart : parti avant la rentrée → l'année d'avant, sa classe et son solde archivés", () => {
  // Cas réel : clôture 2025-2026 faite, élève promu en 5ème, transféré le
  // 15/09/2026 sans avoir vu un seul mois de 2026-2027.
  const eleve = {
    classe: "5ème Année A", statut: "Transféré", dateDepart: "2026-09-15",
    typeInscription: "Réinscription", inscriptionPayee: false, mens: impayes(),
    historique: {
      "2025-2026": {
        classe: "4ème Année A", clotureLe: "2026-07-02T00:00:00.000Z",
        mens: { ...impayes(), Oct: "Payé", Nov: "Payé", Déc: "Payé", Jan: "Payé", Fév: "Payé", Mar: "Payé", Avr: "Payé" },
        inscriptionPayee: true, typeInscription: "Réinscription",
      },
    },
  };
  const s = situationAuDepart(eleve, { moisAnnee: MOIS, tarifsClasses: tarifs, anneeOfficielle: "2026-2027" });
  assert.equal(s.annee, "2025-2026");
  assert.equal(s.classe, "4ème Année A");
  // Mai et Juin 2025-2026 impayés, au tarif de la 4ème ; rien pour 2026-2027.
  assert.equal(s.solde, 2 * 100000);
  assert.equal(s.dateDepart, "15/09/2026");
});

test("situationAuDepart : parti en cours d'année → cette année, mois entamés seulement", () => {
  const eleve = {
    classe: "5ème Année A", statut: "Abandonné", dateDepart: "2027-02-14",
    typeInscription: "Réinscription", inscriptionPayee: true, mens: { ...impayes(), Oct: "Payé" },
  };
  const s = situationAuDepart(eleve, { moisAnnee: MOIS, tarifsClasses: tarifs, anneeOfficielle: "2026-2027" });
  assert.equal(s.annee, "2026-2027");
  assert.equal(s.classe, "5ème Année A");
  // Nov → Fév dus (4 mois), Mar → Juin non.
  assert.equal(s.solde, 4 * 120000);
});
