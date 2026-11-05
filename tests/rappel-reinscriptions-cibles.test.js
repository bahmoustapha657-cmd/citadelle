import assert from "node:assert/strict";
import test from "node:test";

import {
  abonnementsComptables, anneeDuJour, ecritCompta, infoEcole, secretValide,
} from "../supabase/functions/rappel-reinscriptions/cibles.ts";

const ECOLE = "ecole-a";
const compte = (user_id, role, { ecole_id = ECOLE, statut = "Actif", poste = null, fusion = null } = {}) =>
  ({ user_id, role, ecole_id, statut, poste, fusion });
const poste = (cle, permissions = {}, actif = true) => ({ cle, actif, permissions });

test("le rappel va à qui écrit la comptabilité, et à personne d'autre", () => {
  assert.equal(ecritCompta(compte("u", "comptable")), true);
  assert.equal(ecritCompta(compte("u", "comptable", { poste: poste("comptable", { compta: "ecriture" }) })), true);
  // Poste maison qui tient la caisse.
  assert.equal(ecritCompta(compte("u", "staff", { poste: poste("caissier", { compta: "ecriture" }) })), true);
  // La Direction qui ne fait que lire la compta n'est pas réveillée chaque matin.
  assert.equal(ecritCompta(compte("u", "direction", { poste: poste("direction", { compta: "lecture" }) })), false);
  assert.equal(ecritCompta(compte("u", "direction")), false);
  assert.equal(ecritCompta(compte("u", "parent", { poste: poste("x", { compta: "ecriture" }) })), false);
  assert.equal(ecritCompta(compte("u", "enseignant")), false);
  assert.equal(ecritCompta(compte("u", "superadmin")), false);
});

test("abonnements retenus : école, compte joignable, comptabilité", () => {
  const abonnements = [
    { user_id: "c1", ecole_id: ECOLE }, { user_id: "c1", ecole_id: ECOLE },
    { user_id: "c2", ecole_id: ECOLE }, { user_id: "d", ecole_id: ECOLE },
    { user_id: "inactif", ecole_id: ECOLE }, { user_id: "fusionne", ecole_id: ECOLE },
    { user_id: "autre", ecole_id: ECOLE }, { user_id: "inconnu", ecole_id: ECOLE },
  ];
  const comptes = [
    compte("c1", "comptable"),
    compte("c2", "staff", { poste: poste("caissier", { compta: "ecriture" }) }),
    compte("d", "direction", { poste: poste("direction", { compta: "lecture" }) }),
    compte("inactif", "comptable", { statut: "Suspendu" }),
    compte("fusionne", "comptable", { fusion: "x" }),
    compte("autre", "comptable", { ecole_id: "ecole-b" }),
  ];
  assert.deepEqual(abonnementsComptables(abonnements, comptes, ECOLE).map((a) => a.user_id), ["c1", "c1", "c2"]);
  // Poste désactivé : plus rien.
  const posteCoupe = [compte("c2", "staff", { poste: poste("caissier", { compta: "ecriture" }, false) })];
  assert.deepEqual(abonnementsComptables([{ user_id: "c2", ecole_id: ECOLE }], posteCoupe, ECOLE), []);
});

test("réglages de l'école : mêmes replis que l'application", () => {
  const novembre = new Date(Date.UTC(2026, 10, 5));
  assert.equal(anneeDuJour(novembre), "2026-2027");
  assert.equal(anneeDuJour(new Date(Date.UTC(2027, 2, 1))), "2026-2027");
  assert.equal(anneeDuJour(new Date(Date.UTC(2026, 8, 1))), "2026-2027");
  assert.deepEqual(infoEcole(null, novembre), { anneeScolaire: "2026-2027", moisDebut: "Octobre", retraitNonReinscrits: undefined });
  assert.deepEqual(infoEcole({ anneeScolaire: "2025-2026", moisDebut: "Septembre", retraitNonReinscrits: 0 }, novembre),
    { anneeScolaire: "2025-2026", moisDebut: "Septembre", retraitNonReinscrits: 0 });
});

test("secret de la tâche planifiée", () => {
  assert.equal(secretValide("abc123", "abc123"), true);
  assert.equal(secretValide("abc124", "abc123"), false);
  assert.equal(secretValide("abc", "abc123"), false);
  assert.equal(secretValide("", "abc"), false);
  assert.equal(secretValide("abc", undefined), false);
});
