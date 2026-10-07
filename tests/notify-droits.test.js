import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { refusEnvoi } from "../supabase/functions/notify/droits.ts";

const ECOLE_A = "ecole-a";
const ECOLE_B = "ecole-b";
const compte = (role, ecole_id = ECOLE_A, statut = "Actif") => ({ role, ecole_id, statut });
const autorise = (appelant, ecoleId) => refusEnvoi(appelant, ecoleId) === null;
const lire = (chemin) => readFileSync(new URL(chemin, import.meta.url), "utf8");

test("école : un compte d'une autre école est refusé, quel que soit son rôle", () => {
  for (const role of ["direction", "admin", "comptable", "staff", "enseignant", "parent"]) {
    assert.deepEqual(refusEnvoi(compte(role, ECOLE_A), ECOLE_B), { statut: 403, error: "Accès refusé." }, role);
  }
  assert.equal(refusEnvoi(compte("direction", null), ECOLE_A)?.statut, 403);
});

test("compte introuvable ou inactif : refusé", () => {
  assert.deepEqual(refusEnvoi(null, ECOLE_A), { statut: 403, error: "Compte introuvable." });
  assert.deepEqual(refusEnvoi(compte("direction", ECOLE_A, "Inactif"), ECOLE_A), { statut: 403, error: "Compte inactif." });
  assert.equal(refusEnvoi(compte("superadmin", null, "Inactif"), ECOLE_B)?.statut, 403);
  // statut absent = valeur par défaut « Actif » de la table comptes
  assert.ok(autorise(compte("comptable", ECOLE_A, null), ECOLE_A));
});

test("superadmin : toute école", () => {
  assert.ok(autorise(compte("superadmin", null), ECOLE_A));
  assert.ok(autorise(compte("superadmin", null), ECOLE_B));
});

test("personnel de l'école : autorisé", () => {
  for (const role of ["direction", "admin", "comptable", "surveillant", "primaire", "college", "staff"]) {
    assert.ok(autorise(compte(role), ECOLE_A), role);
  }
});

test("parent, enseignant ou rôle absent : refusés même dans leur école", () => {
  for (const role of ["parent", "enseignant", null, ""]) {
    assert.deepEqual(refusEnvoi(compte(role), ECOLE_A), { statut: 403, error: "Envoi réservé au personnel." }, String(role));
  }
});

test("index.ts vérifie l'appelant avant tout envoi, et même inactif", () => {
  const src = lire("../supabase/functions/notify/index.ts");
  const serve = src.slice(src.indexOf("Deno.serve("));
  const refus = serve.indexOf("refusEnvoi(appelant, ec.id)");
  assert.ok(refus > 0, "refusEnvoi appelé avec l'école résolue");
  assert.ok(serve.indexOf('from("ecoles")') < refus, "école résolue avant");
  assert.ok(serve.indexOf('from("comptes")') < refus, "compte de l'appelant lu avant");
  assert.match(serve.slice(refus), /^refusEnvoi\(appelant, ec\.id\);\s*if \(refus\) return json\(\{ error: refus\.error \}, refus\.statut\);/);
  for (const suite of ['method: "inactif"', "estPremiumActif(", 'from("eleves")', "envoyer(", "notifierEleve("]) {
    assert.ok(refus < serve.indexOf(suite), `contrôle avant ${suite}`);
  }
});

test("déclencheurs côté client : uniquement dans le shell du personnel", () => {
  // Liste fermée : un nouvel appelant de notifierParents (portail enseignant
  // ou parent, par exemple) doit d'abord être prévu dans droits.ts.
  const src = new URL("../src/", import.meta.url);
  const appelants = readdirSync(src, { recursive: true })
    .map((f) => String(f).replaceAll("\\", "/"))
    .filter((f) => /\.jsx?$/.test(f) && f !== "backend/notify-supabase.js")
    .filter((f) => /notify-supabase/.test(readFileSync(new URL(f, src), "utf8")))
    .sort();
  assert.deepEqual(appelants, [
    "components/comptabilite/payment-actions.js",
    "components/ecole/discipline-tab/DisciplineModale.jsx",
    "components/messages-parents/use-messages-parents.js",
  ]);
  // … montés par PageRouter, que l'enseignant et le parent n'atteignent pas.
  const auth = lire("../src/components/app/AuthGate.jsx");
  assert.match(auth, /utilisateur\.role === "enseignant"\) return \(/);
  assert.match(auth, /utilisateur\.role === "parent"\) return \(/);
});
