// École publique (étape 4 de l'usage individuel, décisions du 2026-11-18) :
// prix fixe quel que soit l'effectif, tous les outils de gestion. On vérifie :
//  - le plan `publique` (élèves illimités, retour aux limites du gratuit à
//    l'échéance, fonctions facturées à l'usage laissées au Premium) ;
//  - les plans proposés dans la demande d'abonnement ;
//  - le statut déclaré à l'inscription, qui ne donne aucun droit.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLANS } from "../src/constants.js";
import { PLAN_PUBLIQUE, estEcolePublique, planDemandeParDefaut, plansDemandables } from "../src/ecole-publique.js";
import { computePlanInfo } from "../src/components/app/app-shell-plan.js";
import { estPremiumActif } from "../shared/plan-features.js";
import { statutEtablissement } from "../supabase/functions/inscription/ecole.ts";

const source = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), "utf8");
const MAINTENANT = Date.UTC(2026, 10, 19);
const JOUR = 86400000;
const traduire = (_cle, defaut) => defaut;
const plan = (schoolInfoState, totalElevesActifs) =>
  computePlanInfo({ schoolInfoState, nowTs: MAINTENANT, totalElevesActifs, t: traduire });

test("plan École publique : élèves illimités tant qu'il court", () => {
  assert.equal(PLANS[PLAN_PUBLIQUE].eleveLimit, Infinity);
  const actif = plan({ plan: PLAN_PUBLIQUE, planExpiry: MAINTENANT + 200 * JOUR }, 1800);
  assert.equal(actif.eleveLimit, Infinity);
  assert.equal(actif.peutAjouterEleve, true);
  assert.equal(actif.planLabel, "École publique");
  // Échu, après les 3 jours de grâce : limites du gratuit, comme tout plan.
  const echu = plan({ plan: PLAN_PUBLIQUE, planExpiry: MAINTENANT - 10 * JOUR }, 1800);
  assert.equal(echu.planEstExpire, true);
  assert.equal(echu.eleveLimit, PLANS.gratuit.eleveLimit);
  assert.equal(echu.peutAjouterEleve, false);
  const enGrace = plan({ plan: PLAN_PUBLIQUE, planExpiry: MAINTENANT - JOUR }, 1800);
  assert.equal(enGrace.peutAjouterEleve, true);
});

test("plan École publique : SMS et appréciations IA restent au Premium (coût à l'usage)", () => {
  assert.equal(estPremiumActif({ plan: PLAN_PUBLIQUE, planExpiry: MAINTENANT + JOUR, now: MAINTENANT }), false);
  assert.equal(plan({ plan: PLAN_PUBLIQUE, planExpiry: MAINTENANT + JOUR }, 10).estPremium, false);
  // Les copies serveur de la règle ne connaissent que le Premium.
  assert.match(source("supabase/functions/_shared/premium.ts"), /\["premium"\]/);
});

test("demande d'abonnement : l'école publique voit d'abord son offre", () => {
  const publique = { statutEtablissement: "public" };
  const privee = { statutEtablissement: "prive" };
  assert.equal(estEcolePublique(publique), true);
  assert.equal(estEcolePublique(privee), false);
  assert.equal(estEcolePublique({}), false);
  assert.equal(estEcolePublique(null), false);

  assert.deepEqual(plansDemandables(publique, PLANS), ["publique", "starter", "standard", "premium"]);
  // Une école inscrite avant l'étape 4 peut être publique sans l'avoir dit :
  // l'offre reste demandable, en dernier.
  assert.deepEqual(plansDemandables(privee, PLANS), ["starter", "standard", "premium", "publique"]);
  assert.deepEqual(plansDemandables(undefined, PLANS), ["starter", "standard", "premium", "publique"]);
  assert.equal(planDemandeParDefaut(publique, PLANS), "publique");
  assert.equal(planDemandeParDefaut(privee, PLANS), "starter");
  // Jamais le gratuit ; rien sans plans.
  assert.ok(!plansDemandables(publique, PLANS).includes("gratuit"));
  assert.deepEqual(plansDemandables(publique, undefined), []);
  assert.deepEqual(plansDemandables(publique, { gratuit: {}, premium: {} }), ["premium"]);
});

test("inscription : le statut déclaré est « public » ou « privé », sans aucun droit", () => {
  assert.equal(statutEtablissement("public"), "public");
  for (const v of ["prive", "PUBLIC", "", null, undefined, 1, { public: true }]) {
    assert.equal(statutEtablissement(v), "prive", String(v));
  }
  const index = source("supabase/functions/inscription/index.ts");
  assert.match(index, /statutEtablissement: statutEtablissement\(corps\.statutEtablissement\)/);
  // L'école publique s'inscrit en gratuit comme les autres : le plan est
  // attribué par EduGest après vérification (ecoles_guard).
  assert.match(index, /plan: "gratuit", actif: true,/);
  assert.match(source("supabase/migrations/20261118100213_espace_enseignant.sql"),
    /if new\.plan is distinct from old\.plan\s+or new\.plan_expiry is distinct from old\.plan_expiry then/);
});

test("écran d'inscription : le profil École publique suit le parcours d'une école", () => {
  const hook = source("src/inscription/use-inscription.js");
  assert.match(hook, /setProfil\(p === "publique" \? "ecole" : p\);/);
  assert.match(hook, /statutEtablissement: p === "publique" \? "public" : "prive"/);
  assert.match(source("src/inscription/ChoixProfil.jsx"), /onChoisir\("publique"\)/);
  assert.match(source("src/inscription/inscription-api.js"),
    /statutEtablissement: form\.statutEtablissement === "public" \? "public" : "prive",/);
});
