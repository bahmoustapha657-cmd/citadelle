// Connecteur Orange Money Guinée en direct
// (supabase/functions/_shared/paiement/orange.ts) : sans réseau, avec un faux
// `fetch` qui joue le rôle de l'API Orange (api.orange.com).
import assert from "node:assert/strict";
import test from "node:test";
import {
  HOTE, corpsPaiement, creerPaiement, jetonAcces, oublierJeton, problemeIdentifiants,
  verificationDepuis, verifierPaiement,
} from "../supabase/functions/_shared/paiement/orange.ts";

const IDS = { client_id: "client-ecole-pilote", client_secret: "secret-ecole-pilote", merchant_key: "mk-ecole-pilote" };

function fauxOrange(reponses) {
  const appels = [];
  const f = async (url, init = {}) => {
    const { pathname } = new URL(url);
    appels.push({ url, methode: init.method, entetes: init.headers || {}, corps: init.body });
    const cle = Object.keys(reponses).find((k) => pathname.endsWith(k));
    const rep = typeof reponses[cle] === "function" ? reponses[cle](appels.length) : reponses[cle];
    const { status = 200, json = {} } = rep || { status: 404, json: {} };
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  };
  return { f, appels };
}

const creation = (champs = {}) => ({
  reference: "EDUMG1ABCDEF12", montantTotal: 77250, description: "Mensualités — Ibrahima BAH, 7ème A, Ecole pilote",
  origine: "https://edugest-gn.pages.dev",
  urlNotification: "https://abcdefghijklmnopqrst.supabase.co/functions/v1/paiement-notification?fournisseur=orange_money",
  urlRetour: "https://abcdefghijklmnopqrst.supabase.co/functions/v1/paiement-notification?retour=EDUMG1ABCDEF12",
  merchantKey: IDS.merchant_key, mode: "test", ...champs,
});

test("identifiants : Client ID, Client Secret et clé marchand exigés", () => {
  assert.equal(problemeIdentifiants(IDS), null);
  assert.match(problemeIdentifiants({}), /Client ID/);
  assert.match(problemeIdentifiants({ client_id: "x" }), /Client Secret/);
  assert.match(problemeIdentifiants({ client_id: "x", client_secret: "y" }), /clé marchand/i);
});

test("corps de paiement : bac à sable en OUV, production en GNF, référence dans l'adresse de notification", () => {
  const c = corpsPaiement(creation());
  assert.equal(c.merchant_key, IDS.merchant_key);
  assert.equal(c.currency, "OUV");
  assert.equal(c.order_id, "EDUMG1ABCDEF12");
  assert.equal(c.amount, 77250);
  // Retour par le serveur (GET comme POST), aussi pour une annulation.
  assert.equal(c.return_url, creation().urlRetour);
  assert.equal(c.cancel_url, creation().urlRetour);
  // La notification d'Orange ne dit pas quel paiement : &ref= dans l'adresse.
  assert.equal(c.notif_url, `${creation().urlNotification}&ref=EDUMG1ABCDEF12`);
  assert.equal(c.lang, "fr");
  // « reference » : 30 caractères au plus (sinon 400 code 24).
  assert.ok(c.reference.length <= 30);
  assert.equal(corpsPaiement(creation({ mode: "production" })).currency, "GNF");
  assert.throws(() => corpsPaiement(creation({ montantTotal: 0 })), /invalide/);
});

test("création : jeton OAuth (Basic client_id:secret), puis paiement sur le chemin « dev » en test", async () => {
  oublierJeton(IDS);
  const { f, appels } = fauxOrange({
    "/oauth/v3/token": { json: { token_type: "Bearer", access_token: "jwt-o1", expires_in: "3600" } },
    "/webpayment": { status: 201, json: { status: 201, message: "OK", pay_token: "pt-123", payment_url: "https://mpayment.orange-money.com/gn/mpayment/abc", notif_token: "nt-orange-32" } },
  });
  const r = await creerPaiement(IDS, "test", corpsPaiement(creation()), f);
  assert.equal(r.lien, "https://mpayment.orange-money.com/gn/mpayment/abc");
  // Le notif_token est CELUI D'ORANGE (rendu à la création, rappelé dans la notification).
  assert.deepEqual(r.detail, { pay_token: "pt-123", notif_token: "nt-orange-32", montant_envoye: 77250 });
  assert.equal(appels[0].url, `${HOTE}/oauth/v3/token`);
  assert.equal(appels[0].entetes.Authorization, `Basic ${Buffer.from(`${IDS.client_id}:${IDS.client_secret}`).toString("base64")}`);
  assert.equal(appels[0].corps, "grant_type=client_credentials");
  assert.equal(appels[1].url, `${HOTE}/orange-money-webpay/dev/v1/webpayment`);
  assert.equal(appels[1].entetes.Authorization, "Bearer jwt-o1");
  // Second paiement : jeton réutilisé.
  await creerPaiement(IDS, "test", corpsPaiement(creation()), f);
  assert.equal(appels.filter((a) => a.url.endsWith("/oauth/v3/token")).length, 1);
});

test("production : chemin « gn »", async () => {
  oublierJeton(IDS);
  const { f, appels } = fauxOrange({
    "/oauth/v3/token": { json: { access_token: "jwt-p" } },
    "/webpayment": { status: 201, json: { pay_token: "pt", payment_url: "https://x/y", notif_token: "nt" } },
  });
  await creerPaiement(IDS, "production", corpsPaiement(creation({ mode: "production" })), f);
  assert.equal(appels[1].url, `${HOTE}/orange-money-webpay/gn/v1/webpayment`);
});

test("création refusée : message d'Orange, sans les identifiants", async () => {
  oublierJeton(IDS);
  const { f } = fauxOrange({
    "/oauth/v3/token": { json: { access_token: "j" } },
    "/webpayment": { status: 400, json: { code: 24, message: "Invalid reference length" } },
  });
  await assert.rejects(() => creerPaiement(IDS, "test", corpsPaiement(creation()), f), (e) => {
    assert.match(e.message, /Orange Money création : Invalid reference length/);
    assert.ok(!e.message.includes(IDS.client_secret) && !e.message.includes(IDS.merchant_key));
    return true;
  });
  oublierJeton(IDS);
  const refus = fauxOrange({ "/oauth/v3/token": { status: 401, json: { error: "invalid_client" } } });
  await assert.rejects(() => jetonAcces(IDS, refus.f), /refusé les identifiants/);
});

test("jeton expiré (401) : une reconnexion, puis l'appel repart", async () => {
  oublierJeton(IDS);
  let connexions = 0;
  const { f } = fauxOrange({
    "/oauth/v3/token": () => ({ json: { access_token: `jwt-${++connexions}` } }),
    "/transactionstatus": () => (connexions === 1 ? { status: 401, json: {} } : { json: { status: "SUCCESS", txnid: "MP261009.1200.A00001" } }),
  });
  const v = await verifierPaiement(IDS, "test", { reference: "EDUREF", montant: 75000, frais: 2250, detail: { pay_token: "pt", montant_envoye: 77250 } }, f);
  assert.equal(connexions, 2);
  assert.equal(v.statut, "reussi");
  assert.equal(v.operateur, "Orange Money");
});

test("vérification : order_id + montant envoyé + pay_token ; statuts Orange → EduGest", async () => {
  oublierJeton(IDS);
  const { f, appels } = fauxOrange({
    "/oauth/v3/token": { json: { access_token: "j" } },
    "/transactionstatus": { json: { status: "PENDING", order_id: "EDUREF" } },
  });
  const v = await verifierPaiement(IDS, "test", { reference: "EDUREF", montant: 75000, frais: 2250, detail: { pay_token: "pt-9", montant_envoye: 77250 } }, f);
  assert.equal(v.statut, "en_attente");
  assert.equal(appels[1].url, `${HOTE}/orange-money-webpay/dev/v1/transactionstatus`);
  assert.deepEqual(JSON.parse(appels[1].corps), { order_id: "EDUREF", amount: 77250, pay_token: "pt-9" });

  assert.equal(verificationDepuis({ status: "SUCCESS" }).statut, "reussi");
  assert.equal(verificationDepuis({ status: "FAILED" }).statut, "echoue");
  assert.equal(verificationDepuis({ status: "EXPIRED" }).statut, "echoue");
  assert.equal(verificationDepuis({ status: "INITIATED" }).statut, "en_attente");
  // Montant jamais inventé : celui fixé à la création fait foi.
  assert.equal(verificationDepuis({ status: "SUCCESS" }).montant, undefined);
});

test("vérification sans pay_token : en attente, aucun appel ; panne d'Orange : exception", async () => {
  const rien = fauxOrange({});
  assert.equal((await verifierPaiement(IDS, "test", { reference: "R", montant: 1, frais: 0, detail: {} }, rien.f)).statut, "en_attente");
  assert.equal(rien.appels.length, 0);
  oublierJeton(IDS);
  const panne = fauxOrange({ "/oauth/v3/token": { json: { access_token: "j" } }, "/transactionstatus": { status: 503, json: {} } });
  await assert.rejects(() => verifierPaiement(IDS, "test", { reference: "R", montant: 1, frais: 0, detail: { pay_token: "p" } }, panne.f), /Orange Money vérification/);
});
