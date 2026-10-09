// Connecteur CinetPay (supabase/functions/_shared/paiement/cinetpay.ts) et
// configuration d'une école (configuration.ts) : sans réseau, avec un faux
// `fetch` qui joue le rôle de l'API CinetPay.
import assert from "node:assert/strict";
import test from "node:test";
import {
  HOTES, corpsPaiement, creerPaiement, jetonAcces, jetonNotificationValide, modeDeCle, oublierJeton,
  problemeIdentifiants, verificationDepuis, verifierPaiement,
} from "../supabase/functions/_shared/paiement/cinetpay.ts";
import {
  clientPayeur, horsBornes, masquer, plafondScolarite, validerConfiguration, vueConfiguration,
} from "../supabase/functions/_shared/paiement/configuration.ts";
import { calculerFrais } from "../supabase/functions/_shared/paiement/regles.ts";

const TEST = { api_key: "sk_test_ecole_pilote_1234", api_password: "mot-de-passe-api" };

// Faux serveur CinetPay : enregistre les appels, répond selon le chemin.
function fauxCinetpay(reponses) {
  const appels = [];
  const f = async (url, init = {}) => {
    const { pathname } = new URL(url);
    appels.push({ url, methode: init.method || "GET", entetes: init.headers || {}, corps: init.body ? JSON.parse(init.body) : null });
    const cle = Object.keys(reponses).find((k) => pathname.startsWith(k));
    const rep = typeof reponses[cle] === "function" ? reponses[cle](appels.length) : reponses[cle];
    const { status = 200, json = {} } = rep || { status: 404, json: { status: "NOT_FOUND" } };
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  };
  return { f, appels };
}

const creation = (champs = {}) => ({
  reference: "EDUMG1ABCDEF12", montantTotal: 77250, devise: "GNF", description: "Mensualités — Ibrahima BAH",
  origine: "https://edugest-gn.pages.dev",
  urlNotification: "https://abcdefghijklmnopqrst.supabase.co/functions/v1/paiement-notification?fournisseur=cinetpay",
  client: { prenom: "Mamadou", nom: "Bah", email: "" }, ...champs,
});

test("clé → mode et hôte : sk_test_ = bac à sable, sk_live_ = production", () => {
  assert.equal(modeDeCle("sk_test_abc"), "test");
  assert.equal(modeDeCle("sk_live_abc"), "production");
  assert.equal(modeDeCle("pk_live_abc"), null);
  assert.equal(modeDeCle(undefined), null);
  assert.equal(problemeIdentifiants(TEST, "test"), null);
  assert.match(problemeIdentifiants(TEST, "production"), /sk_live_/);
  assert.match(problemeIdentifiants({ api_key: "sk_live_x" }, "production"), /Mot de passe/);
  assert.match(problemeIdentifiants({ api_key: "abc", api_password: "x" }, "test"), /invalide/);
});

test("corps de paiement : GNF, référence, retour vers l'app, payeur et e-mail par défaut", () => {
  const c = corpsPaiement(creation());
  assert.equal(c.currency, "GNF");
  assert.equal(c.merchant_transaction_id, "EDUMG1ABCDEF12");
  assert.equal(c.amount, 77250);
  assert.equal(c.success_url, "https://edugest-gn.pages.dev/?paiement=EDUMG1ABCDEF12");
  assert.equal(c.failed_url, c.success_url);
  assert.equal(c.channel, "PUSH");
  assert.equal(c.client_first_name, "Mamadou");
  assert.equal(c.client_email, "paiement@edugest.app");
  assert.equal(corpsPaiement(creation({ client: { email: "parent@exemple.gn" } })).client_email, "parent@exemple.gn");
  // Noms trop courts : remplacés (CinetPay exige 2 caractères).
  const court = corpsPaiement(creation({ client: { prenom: "A", nom: "" } }));
  assert.equal(court.client_first_name, "Parent");
  assert.equal(court.client_last_name, "EduGest");
});

test("corps de paiement : bornes CinetPay et adresses de 120 caractères au plus", () => {
  assert.throws(() => corpsPaiement(creation({ montantTotal: 99 })), /limites/);
  assert.throws(() => corpsPaiement(creation({ montantTotal: 2_500_001 })), /limites/);
  assert.equal(corpsPaiement(creation({ montantTotal: 2_500_000 })).amount, 2_500_000);
  assert.throws(() => corpsPaiement(creation({ urlNotification: `https://x.co/${"a".repeat(120)}` })), /trop longue/);
});

test("création : connexion puis paiement sur le bac à sable, jeton réutilisé", async () => {
  oublierJeton(TEST);
  const { f, appels } = fauxCinetpay({
    "/v1/oauth/login": { json: { access_token: "jwt-1" } },
    "/v1/payment": { json: { code: 200, status: "OK", payment_url: "https://checkout.cinetpay.net/p/abc", payment_token: "pt", notify_token: "nt-secret", transaction_id: "CP1" } },
  });
  const r = await creerPaiement(TEST, corpsPaiement(creation()), f);
  assert.equal(r.lien, "https://checkout.cinetpay.net/p/abc");
  assert.deepEqual(r.detail, { payment_token: "pt", notify_token: "nt-secret", transaction_id: "CP1" });
  assert.equal(appels[0].url, `${HOTES.test}/v1/oauth/login`);
  assert.deepEqual(appels[0].corps, { api_key: TEST.api_key, api_password: TEST.api_password });
  assert.equal(appels[1].url, `${HOTES.test}/v1/payment`);
  assert.equal(appels[1].entetes.Authorization, "Bearer jwt-1");
  // Second paiement : pas de nouvelle connexion.
  await creerPaiement(TEST, corpsPaiement(creation()), f);
  assert.equal(appels.filter((a) => a.url.endsWith("/v1/oauth/login")).length, 1);
});

test("jeton expiré : une reconnexion, puis l'appel repart", async () => {
  oublierJeton(TEST);
  let connexions = 0;
  const { f } = fauxCinetpay({
    "/v1/oauth/login": () => ({ json: { access_token: `jwt-${++connexions}` } }),
    "/v1/payment/": () => (connexions === 1
      ? { status: 401, json: { code: 1003, status: "EXPIRED_TOKEN" } }
      : { json: { code: 100, status: "SUCCESS", transaction_id: "CP9" } }),
  });
  const v = await verifierPaiement(TEST, "EDUREF", f);
  assert.equal(connexions, 2);
  assert.equal(v.statut, "reussi");
  assert.equal(v.operateur, "CinetPay");
});

test("identifiants refusés : message clair, sans les identifiants", async () => {
  oublierJeton(TEST);
  const { f } = fauxCinetpay({ "/v1/oauth/login": { status: 401, json: { code: 1005, status: "INVALID_CREDENTIALS" } } });
  await assert.rejects(() => jetonAcces(TEST, f), (e) => {
    assert.match(e.message, /refusé les identifiants/);
    assert.ok(!e.message.includes(TEST.api_password));
    return true;
  });
});

test("statuts CinetPay → statuts EduGest", () => {
  assert.equal(verificationDepuis({ status: "SUCCESS", code: 100 }).statut, "reussi");
  for (const s of ["FAILED", "EXPIRED", "INSUFFICIENT_BALANCE", "OTP_ERROR", "USER_IS_BLOCKED"]) {
    assert.equal(verificationDepuis({ status: s }).statut, "echoue", s);
  }
  for (const s of ["INITIATED", "PENDING", ""]) assert.equal(verificationDepuis({ status: s }).statut, "en_attente", s);
  // Aucun montant inventé : c'est celui fixé à la création.
  assert.equal(verificationDepuis({ status: "SUCCESS" }).montant, undefined);
});

test("vérification : inconnu = en attente, erreur serveur = exception (rien de conclu)", async () => {
  oublierJeton(TEST);
  const inconnu = fauxCinetpay({ "/v1/oauth/login": { json: { access_token: "j" } }, "/v1/payment/": { status: 404, json: { code: 404, status: "NOT_FOUND" } } });
  assert.equal((await verifierPaiement(TEST, "EDUREF", inconnu.f)).statut, "en_attente");
  assert.match(inconnu.appels[1].url, /\/v1\/payment\/EDUREF$/);
  oublierJeton(TEST);
  const panne = fauxCinetpay({ "/v1/oauth/login": { json: { access_token: "j" } }, "/v1/payment/": { status: 503, json: {} } });
  await assert.rejects(() => verifierPaiement(TEST, "EDUREF", panne.f), /CinetPay vérification/);
});

test("notification : le jeton doit être celui remis à la création", () => {
  assert.equal(jetonNotificationValide("nt-secret", "nt-secret"), true);
  assert.equal(jetonNotificationValide("nt-secreT", "nt-secret"), false);
  assert.equal(jetonNotificationValide("", "nt-secret"), false);
  assert.equal(jetonNotificationValide("nt-secret", undefined), false);
  assert.equal(jetonNotificationValide(undefined, undefined), false);
});

// ── Configuration d'une école ──────────────────────────────────────────────
const FOURNISSEURS = {
  cinetpay: { nom: "cinetpay", libelle: "CinetPay", probleme: (c) => problemeIdentifiants(c.identifiants, c.mode) },
  simulation: { nom: "simulation", libelle: "Simulation" },
};
const existante = { fournisseur: "cinetpay", mode: "test", actif: true, frais_pourcent: 3, identifiants: TEST };

test("configuration : un champ laissé vide garde l'identifiant enregistré", () => {
  const v = validerConfiguration({ fournisseur: "cinetpay", mode: "test", actif: true, fraisPourcent: 2.5, identifiants: { api_key: "", api_password: "  " } }, existante, FOURNISSEURS);
  assert.equal(v.ok, true);
  assert.deepEqual(v.config.identifiants, TEST);
  assert.equal(v.config.frais_pourcent, 2.5);
  const nouvelle = validerConfiguration({ fournisseur: "cinetpay", mode: "test", actif: true, identifiants: { api_password: "nouveau" } }, existante, FOURNISSEURS);
  assert.equal(nouvelle.config.identifiants.api_password, "nouveau");
  assert.equal(nouvelle.config.identifiants.api_key, TEST.api_key);
});

test("configuration : refus clairs (opérateur, mode, frais, clé incohérente)", () => {
  assert.match(validerConfiguration({ fournisseur: "inconnu", mode: "test" }, null, FOURNISSEURS).erreur, /inconnu/);
  assert.match(validerConfiguration({ fournisseur: "cinetpay", mode: "live" }, null, FOURNISSEURS).erreur, /Mode/);
  assert.match(validerConfiguration({ fournisseur: "cinetpay", mode: "test", fraisPourcent: 25 }, null, FOURNISSEURS).erreur, /20 %/);
  // Passer en production avec la clé de test : refusé.
  assert.match(validerConfiguration({ fournisseur: "cinetpay", mode: "production", actif: true }, existante, FOURNISSEURS).erreur, /sk_live_/);
  // Désactivé : on peut enregistrer des réglages incomplets.
  assert.equal(validerConfiguration({ fournisseur: "cinetpay", mode: "production", actif: false }, null, FOURNISSEURS).ok, true);
});

test("configuration : changer d'opérateur ne reprend pas les anciens identifiants", () => {
  const v = validerConfiguration({ fournisseur: "simulation", mode: "test", actif: true }, existante, FOURNISSEURS);
  assert.deepEqual(v.config.identifiants, {});
});

test("vue de la direction : identifiants masqués, jamais en clair", () => {
  const vue = vueConfiguration(existante, Object.values(FOURNISSEURS));
  assert.equal(vue.cle, "sk_test_…1234");
  assert.equal(vue.motDePassePose, true);
  assert.ok(!JSON.stringify(vue).includes(TEST.api_password));
  assert.ok(!JSON.stringify(vue).includes(TEST.api_key));
  assert.equal(masquer("court"), "…");
  assert.equal(masquer(""), null);
  assert.equal(vueConfiguration(null, []).actif, false);
});

test("payeur : nom du compte découpé, sinon l'élève", () => {
  assert.deepEqual(clientPayeur({ nom: "Mamadou Saliou Bah", email: "m@x.gn" }, {}), { prenom: "Mamadou", nom: "Saliou Bah", email: "m@x.gn" });
  assert.deepEqual(clientPayeur({ nom: "Parent" }, { prenom: "Ibrahima", nom: "BAH" }), { prenom: "Parent", nom: "BAH", email: "" });
  assert.deepEqual(clientPayeur({}, { prenom: "Ibrahima", nom: "BAH" }), { prenom: "Ibrahima", nom: "BAH", email: "" });
});

test("plafond : scolarité + frais arrondis ne dépassent jamais le plafond de l'opérateur", () => {
  for (const pourcent of [0, 1, 2.5, 3, 3.5, 7]) {
    const m = plafondScolarite(2_500_000, pourcent);
    assert.ok(m + calculerFrais(m, pourcent) <= 2_500_000, `${pourcent} %`);
    assert.ok(m + 1 + calculerFrais(m + 1, pourcent) > 2_500_000, `${pourcent} % : le plus grand possible`);
  }
  assert.equal(plafondScolarite(undefined, 3), Infinity);
  assert.equal(horsBornes(77250, { montantMin: 100, montantMax: 2_500_000 }), null);
  assert.match(horsBornes(2_600_000, { montantMax: 2_500_000 }), /plusieurs fois/);
  assert.match(horsBornes(50, { montantMin: 100 }), /trop faible/);
  assert.equal(horsBornes(10_000_000, {}), null);
});
