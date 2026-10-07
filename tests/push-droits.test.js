import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { nettoyerCibles, nettoyerUserIds, refusEnvoi } from "../supabase/functions/push/droits.ts";

const ECOLE_A = "ecole-a";
const ECOLE_B = "ecole-b";
const compte = (role, ecole_id = ECOLE_A, statut = "Actif") => ({ role, ecole_id, statut });
const demande = ({ cibles = [], userIds = [], tousStaff = false } = {}) => ({ cibles, userIds, tousStaff });
const autorise = (appelant, ecoleId, d) => refusEnvoi(appelant, ecoleId, d) === null;

test("école : un compte d'une autre école est refusé, quel que soit le ciblage", () => {
  for (const role of ["direction", "comptable", "staff", "enseignant", "parent"]) {
    for (const d of [demande({ cibles: ["direction"] }), demande({ tousStaff: true }), demande({ userIds: ["u1"] })]) {
      assert.deepEqual(refusEnvoi(compte(role, ECOLE_A), ECOLE_B, d), { statut: 403, error: "Accès refusé." }, role);
    }
  }
  assert.equal(refusEnvoi(compte("direction", null), ECOLE_A, demande({ userIds: ["u1"] }))?.statut, 403);
});

test("compte introuvable ou inactif : refusé", () => {
  assert.equal(refusEnvoi(null, ECOLE_A, demande({ userIds: ["u1"] }))?.statut, 403);
  assert.equal(refusEnvoi(compte("direction", ECOLE_A, "Inactif"), ECOLE_A, demande({ cibles: ["parent"] }))?.statut, 403);
  assert.equal(refusEnvoi(compte("superadmin", null, "Inactif"), ECOLE_A, demande({ tousStaff: true }))?.statut, 403);
  // statut absent = valeur par défaut « Actif » de la table comptes
  assert.ok(autorise(compte("direction", ECOLE_A, null), ECOLE_A, demande({ cibles: ["parent"] })));
});

test("superadmin : toute école, tout ciblage", () => {
  const sa = compte("superadmin", null);
  assert.ok(autorise(sa, ECOLE_B, demande({ tousStaff: true })));
  assert.ok(autorise(sa, ECOLE_B, demande({ cibles: ["direction", "parent"] })));
  assert.ok(autorise(sa, ECOLE_B, demande({ userIds: ["u1"] })));
});

test("personnel de l'école : cibles par rôle, tousStaff et userIds", () => {
  for (const role of ["direction", "admin", "comptable", "surveillant", "primaire", "college", "staff"]) {
    assert.ok(autorise(compte(role), ECOLE_A, demande({ cibles: ["parent"] })), role);
    assert.ok(autorise(compte(role), ECOLE_A, demande({ cibles: ["direction", "comptable"] })), role);
    assert.ok(autorise(compte(role), ECOLE_A, demande({ tousStaff: true })), role);
    assert.ok(autorise(compte(role), ECOLE_A, demande({ userIds: ["u1"] })), role);
  }
});

test("parent : userIds seulement (messagerie interne)", () => {
  const p = compte("parent");
  assert.ok(autorise(p, ECOLE_A, demande({ userIds: ["u1", "u2"] })));
  for (const d of [
    demande({ cibles: ["direction"] }),
    demande({ cibles: ["parent"] }),
    demande({ tousStaff: true }),
    demande({ cibles: ["direction"], userIds: ["u1"] }),
  ]) {
    assert.deepEqual(refusEnvoi(p, ECOLE_A, d), { statut: 403, error: "Envoi réservé au personnel." });
  }
});

test("enseignant : userIds, et les parents seulement pour un signalement", () => {
  const e = compte("enseignant");
  assert.ok(autorise(e, ECOLE_A, demande({ userIds: ["u1"] })));
  // portail enseignant, incidents-actions.js : envoyerPush(["parent"], …)
  assert.ok(autorise(e, ECOLE_A, demande({ cibles: ["parent"] })));
  for (const d of [
    demande({ cibles: ["direction"] }),
    demande({ cibles: ["parent", "comptable"] }),
    demande({ tousStaff: true }),
    demande({ cibles: ["parent"], tousStaff: true }),
  ]) {
    assert.equal(refusEnvoi(e, ECOLE_A, d)?.statut, 403);
  }
});

test("nettoyage : caractères hors liste blanche retirés (filtre PostgREST)", () => {
  assert.deepEqual(nettoyerCibles(["parent", "direction),user_id.neq.(x", "", "poste.cle-1_a"]),
    ["parent", "directionuser_id.neq.x", "poste.cle-1_a"]);
  assert.deepEqual(nettoyerCibles("parent"), []);
  assert.deepEqual(nettoyerUserIds(["0f1e-ab", "x),role.in.(direction", 42]), ["0f1e-ab", "edec", "42"]);
  assert.deepEqual(nettoyerUserIds(null), []);
});

test("index.ts vérifie l'appelant avant de lire les abonnements", () => {
  const src = readFileSync(new URL("../supabase/functions/push/index.ts", import.meta.url), "utf8");
  const refus = src.indexOf("refusEnvoi(appelant, ec.id");
  assert.ok(refus > 0, "refusEnvoi appelé avec l'école résolue");
  const lectureAppelant = src.indexOf('.eq("user_id", user.id)');
  assert.ok(lectureAppelant > 0 && lectureAppelant < refus, "compte de l'appelant lu avant");
  assert.ok(refus < src.indexOf("await lireAbonnements("), "contrôle avant la lecture de push_subs");
});
