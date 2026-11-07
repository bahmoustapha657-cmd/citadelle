import test from "node:test";
import assert from "node:assert/strict";
import {
  INDICE_REFUS_ENCAISSEMENTS, estRefusEncaissements, messageConfirmationSuppression,
  messageErreurSuppression, messageSuppressionRefusee, porteDesEncaissements,
} from "../src/components/comptabilite/enrolment/suppression-eleve.js";

const vierge = { _id: "e1", nom: "BAH", prenom: "Awa", mens: { Oct: "Impayé", Nov: "Impayé" } };

test("fiche vierge, aucune ligne au journal : la suppression reste possible", () => {
  assert.equal(porteDesEncaissements(vierge, []), false);
  // Les lignes d'un AUTRE élève ne comptent pas.
  assert.equal(porteDesEncaissements(vierge, [{ eleveId: "e2", montant: 75000 }]), false);
  // Rien de « vrai » dans les cartes de frais et d'acomptes.
  assert.equal(porteDesEncaissements({ ...vierge, fraisPayes: { tenue: false }, mensAcomptes: { Oct: 0 }, inscriptionAcompte: 0 }, []), false);
});

test("une ligne au journal de caisse suffit — même annulée (la trace reste)", () => {
  assert.equal(porteDesEncaissements(vierge, [{ eleveId: "e1", statut: "encaisse" }]), true);
  assert.equal(porteDesEncaissements(vierge, [{ eleveId: "e1", statut: "annule" }]), true);
});

test("encaissement porté par la fiche, sans journal (paiement antérieur ou non journalisé)", () => {
  assert.equal(porteDesEncaissements({ ...vierge, mens: { Oct: "Payé" } }, []), true);
  assert.equal(porteDesEncaissements({ ...vierge, inscriptionPayee: true }, []), true);
  assert.equal(porteDesEncaissements({ ...vierge, inscriptionAcompte: 20000 }, []), true);
  assert.equal(porteDesEncaissements({ ...vierge, autrePayee: true }, []), true);
  assert.equal(porteDesEncaissements({ ...vierge, fraisPayes: { tenue: true } }, []), true);
  assert.equal(porteDesEncaissements({ ...vierge, mensAcomptes: { Oct: 30000 } }, []), true);
  assert.equal(porteDesEncaissements({ ...vierge, fraisAcomptes: { tenue: 5000 } }, []), true);
});

test("encaissement dans l'archive d'une année close : la fiche est protégée aussi", () => {
  const archive = { ...vierge, historique: { "2025-2026": { classe: "6ème A", mens: { Oct: "Payé" }, clotureLe: "2026-07-01" } } };
  assert.equal(porteDesEncaissements(archive, []), true);
  const archiveVide = { ...vierge, historique: { "2025-2026": { classe: "6ème A", mens: { Oct: "Impayé" } }, x: null } };
  assert.equal(porteDesEncaissements(archiveVide, []), false);
});

test("fiche sans identifiant : jamais confondue avec une ligne sans élève", () => {
  assert.equal(porteDesEncaissements({ nom: "X" }, [{ eleveId: undefined }]), false);
});

test("messages : nom de l'élève, départ proposé, conséquences annoncées", () => {
  const refus = messageSuppressionRefusee(vierge);
  assert.match(refus, /^BAH Awa a des encaissements/);
  assert.match(refus, /Déclarer son départ maintenant \?$/);
  const confirmation = messageConfirmationSuppression(vierge);
  assert.match(confirmation, /Supprimer définitivement la fiche de BAH Awa/);
  assert.match(confirmation, /notes, absences et appréciations/);
  assert.match(messageConfirmationSuppression({}), /cet élève/);
});

test("refus du serveur : garde SQL (hint) ou clé étrangère (23503) → message clair", () => {
  const garde = Object.assign(new Error("Suppression refusée : …"), { code: "P0001", hint: INDICE_REFUS_ENCAISSEMENTS });
  const cle = Object.assign(new Error("violates foreign key constraint"), { code: "23503" });
  assert.equal(estRefusEncaissements(garde), true);
  assert.equal(estRefusEncaissements(cle), true);
  assert.match(messageErreurSuppression(garde, vierge), /BAH Awa a des encaissements.*déclarez plutôt son départ/);
  assert.match(messageErreurSuppression(cle, vierge), /Suppression refusée/);
  // Une autre erreur n'est pas maquillée en refus métier.
  const panne = new Error("Failed to fetch");
  assert.equal(estRefusEncaissements(panne), false);
  assert.equal(messageErreurSuppression(panne, vierge), "Suppression impossible : Failed to fetch");
  assert.equal(estRefusEncaissements(undefined), false);
});
