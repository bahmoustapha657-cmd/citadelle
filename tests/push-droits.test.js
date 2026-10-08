import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  nettoyerCibles, nettoyerEleveId, nettoyerUserIds, refusEnseignantEleve, refusEnvoi, refusParents,
} from "../supabase/functions/push/droits.ts";

const ECOLE_A = "ecole-a";
const ECOLE_B = "ecole-b";
const compte = (role, ecole_id = ECOLE_A, statut = "Actif") => ({ role, ecole_id, statut });
const demande = ({ cibles = [], userIds = [], tousStaff = false, eleveId = "" } = {}) => ({ cibles, userIds, tousStaff, eleveId });
const ELEVE = "3f2a9c1e-7b4d-4e8a-9c0f-1a2b3c4d5e6f";
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
  // portail enseignant, incidents-actions.js : envoyerPush(["parent"], …, { eleveId })
  assert.ok(autorise(e, ECOLE_A, demande({ cibles: ["parent"], eleveId: ELEVE })));
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

test("nettoyerEleveId : un uuid, sinon rien", () => {
  assert.equal(nettoyerEleveId(ELEVE), ELEVE);
  assert.equal(nettoyerEleveId(` ${ELEVE.toUpperCase()} `), ELEVE);
  for (const v of [undefined, null, "", 42, [ELEVE], { id: ELEVE }, "pas-un-uuid", `${ELEVE}x`,
    `${ELEVE.slice(0, -1)}),eleve_id.neq.(x`]) {
    assert.equal(nettoyerEleveId(v), "", JSON.stringify(v));
  }
});

test("fuite entre familles : la cible « parent » exige l'élève concerné", () => {
  // Ancien client (avant eleveId) : refusé, quel que soit l'appelant.
  const sansEleve = { statut: 400, error: "eleveId requis pour notifier des parents." };
  assert.deepEqual(refusParents(demande({ cibles: ["parent"] })), sansEleve);
  assert.deepEqual(refusParents(demande({ cibles: ["direction", "parent"] })), sansEleve);
  assert.deepEqual(refusParents(demande({ cibles: ["parent"], userIds: ["u1"] })), sansEleve);
  // Avec l'élève : accepté (le tri des parents se fait dans destinataires.ts).
  assert.equal(refusParents(demande({ cibles: ["parent"], eleveId: ELEVE })), null);
  // Sans cible « parent » : rien à vérifier.
  for (const d of [demande({ cibles: ["direction"] }), demande({ userIds: ["u1"] }), demande({ tousStaff: true })]) {
    assert.equal(refusParents(d), null, JSON.stringify(d));
  }
});

test("enseignant : les parents d'un élève de SES classes seulement", () => {
  const e = compte("enseignant");
  const classes = [{ section: "college", classe: "6ème A" }, { section: "primaire", classe: "CM1" }];
  assert.equal(refusEnseignantEleve(e, { section: "college", classe: "6ème A" }, classes), null);
  assert.equal(refusEnseignantEleve(e, { section: "primaire", classe: "CM1" }, classes), null);
  const hors = { statut: 403, error: "Élève hors de vos classes." };
  // autre classe, même nom de classe dans une autre section, élève sans classe
  assert.deepEqual(refusEnseignantEleve(e, { section: "college", classe: "6ème B" }, classes), hors);
  assert.deepEqual(refusEnseignantEleve(e, { section: "lycee", classe: "6ème A" }, classes), hors);
  assert.deepEqual(refusEnseignantEleve(e, { section: "college", classe: null }, classes), hors);
  assert.deepEqual(refusEnseignantEleve(e, { section: "college", classe: "6ème A" }, []), hors);
  // même règle que my_teacher_eleve_ids() : égalité stricte du nom de classe
  assert.deepEqual(refusEnseignantEleve(e, { section: "college", classe: "6ème a" }, classes), hors);
  // le personnel n'est pas borné aux classes
  for (const role of ["direction", "comptable", "surveillant", "staff", "superadmin"]) {
    assert.equal(refusEnseignantEleve(compte(role), { section: "college", classe: "6ème B" }, []), null, role);
  }
});

test("index.ts borne l'enseignant à ses classes avant de lire les abonnements", () => {
  const src = readFileSync(new URL("../supabase/functions/push/index.ts", import.meta.url), "utf8");
  const serve = src.indexOf("Deno.serve(");
  const controle = src.indexOf("refusEnseignantEleve(appelant, lus.eleve, classes)", serve);
  assert.ok(controle > 0, "refusEnseignantEleve appelé avec la classe de l'élève");
  assert.ok(src.indexOf("await lireClassesEnseignant(admin, appelant.id, ec.id)", serve) < controle);
  assert.ok(controle < src.indexOf("await lireAbonnements(", serve), "avant la lecture de push_subs");
  assert.match(src, /select\("id, role, ecole_id, statut"\)\.eq\("user_id", user\.id\)/);
  const fn = src.slice(src.indexOf("async function lireClassesEnseignant("), serve);
  assert.match(fn, /from\("enseignant_classes"\)[^;]*\.eq\("compte_id", compteId\)\.eq\("ecole_id", ecoleId\)/);
});

test("index.ts vérifie l'appelant avant de lire les abonnements", () => {
  const src = readFileSync(new URL("../supabase/functions/push/index.ts", import.meta.url), "utf8");
  const refus = src.indexOf("refusEnvoi(appelant, ec.id");
  assert.ok(refus > 0, "refusEnvoi appelé avec l'école résolue");
  const lectureAppelant = src.indexOf('.eq("user_id", user.id)');
  assert.ok(lectureAppelant > 0 && lectureAppelant < refus, "compte de l'appelant lu avant");
  assert.ok(refus < src.indexOf("await lireAbonnements("), "contrôle avant la lecture de push_subs");
  assert.ok(refus < src.indexOf("await lireParentsEleve("), "contrôle avant la lecture des parents");
});

test("index.ts : eleveId nettoyé et demande sans élève refusée avant toute lecture", () => {
  const src = readFileSync(new URL("../supabase/functions/push/index.ts", import.meta.url), "utf8");
  const serve = src.indexOf("Deno.serve(");
  assert.match(src, /eleveId: nettoyerEleveId\(body\.eleveId\)/);
  const parents = src.indexOf("refusParents(demande)", serve);
  assert.ok(parents > 0, "refusParents appelé");
  assert.ok(parents < src.indexOf('from("ecoles")', serve), "avant la lecture de l'école");
  // L'élève doit être de l'école visée avant qu'on lise ses parents.
  const fn = src.slice(src.indexOf("async function lireParentsEleve("), serve);
  assert.match(fn, /from\("eleves"\)[^;]*\.eq\("ecole_id", ecoleId\)/);
  assert.ok(fn.indexOf('from("eleves")') < fn.indexOf('from("parent_eleves")'));
  assert.match(src, /lireAbonnements\(admin, ec\.id, candidats\(demande, parentsEleve\)\)/);
});
