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
import {
  PLAN_PUBLIQUE, PRIX_MENSUEL_PUBLIQUE, estEcolePublique, planDemandeParDefaut, plansDemandables, prixEcolePublique,
} from "../src/ecole-publique.js";
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

  // La fiche école peut arriver APRÈS l'ouverture du tableau de bord (miroir
  // hors ligne) : l'offre par défaut se recalcule tant que rien n'est choisi,
  // au lieu d'être figée au premier rendu (e2e hors-ligne rouge sinon).
  const hook = source("src/components/tableau-de-bord/use-tableau-de-bord.js");
  assert.match(hook, /const \[choixPlan, setDemandePlan\] = useState\(null\);/);
  assert.match(hook, /const demandePlan = choixPlan \|\| planDemandeParDefaut\(schoolInfo, PLANS\) \|\| "starter";/);
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

test("prix de l'offre : 100 000 GNF par mois, une seule source pour tous les textes", () => {
  assert.equal(PRIX_MENSUEL_PUBLIQUE, 100000);
  assert.match(prixEcolePublique(), /^100\s000 GNF$/);
  const locale = (langue) => JSON.parse(source(`src/i18n/locales/${langue}.json`));
  for (const langue of ["fr", "en", "ar"]) {
    const o = locale(langue);
    // Le montant n'est écrit dans aucune langue : il arrive par {{prix}}.
    for (const texte of [o.dashboard.sub.fixedPrice, o.dashboard.sub.publicNote, o.register.public.fixedPrice,
      o.register.public.info]) {
      assert.match(texte, /\{\{prix\}\}/, `${langue} : ${texte}`);
      assert.doesNotMatch(texte, /100/, `${langue} : ${texte}`);
    }
    for (const cle of ["publicTitle", "publicFeature1", "publicFeature2", "publicFeature3", "publicFeature4", "publicCta"]) {
      assert.ok(o.landing[cle], `${langue} : landing.${cle}`);
    }
  }
  assert.equal(locale("fr").register.public.fixedPrice.replace("{{prix}}", prixEcolePublique()).replace(/\s/g, " "), "100 000 GNF / mois");
  // Chaque écran passe le prix au texte.
  assert.match(source("src/inscription/ChoixProfil.jsx"), /t\("register\.public\.fixedPrice", \{ prix: prixEcolePublique\(\) \}\)/);
  assert.match(source("src/inscription/EtapeEcole.jsx"), /t\("register\.public\.info", \{ prix: prixEcolePublique\(\) \}\)/);
  assert.match(source("src/components/tableau-de-bord/abonnement/AbonnementDemandeForm.jsx"), /t\("dashboard\.sub\.publicNote", \{ prix \}\)/);
  assert.match(source("src/components/landing/LandingTarifs.jsx"), /<BandeEcolePublique onInscription=\{onInscription\} \/>/);
});

test("écran d'inscription : le profil École publique suit le parcours d'une école", () => {
  const hook = source("src/inscription/use-inscription.js");
  assert.match(hook, /setProfil\(p === "publique" \? "ecole" : p\);/);
  assert.match(hook, /statutEtablissement: p === "publique" \? "public" : "prive"/);
  assert.match(source("src/inscription/ChoixProfil.jsx"), /onChoisir\("publique"\)/);
  assert.match(source("src/inscription/inscription-api.js"),
    /statutEtablissement: form\.statutEtablissement === "public" \? "public" : "prive",/);
});
