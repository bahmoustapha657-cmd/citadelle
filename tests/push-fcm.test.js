import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import test from "node:test";

import {
  assertionGoogle, donneesFcm, envoyerFcm, estAppareilAndroid, jetonAcces, lireCompteFcm, messageFcm,
} from "../supabase/functions/push/fcm.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const COMPTE = {
  project_id: "citadelle-test", client_email: "push@citadelle-test.iam",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
};

const lire = (partie) => JSON.parse(Buffer.from(partie, "base64url").toString());

test("appareil Android : reconnu à son jeton, jamais un abonnement Web Push", () => {
  assert.equal(estAppareilAndroid({ endpoint: "fcm:x", fcm: "x" }), true);
  assert.equal(estAppareilAndroid({ endpoint: "https://fcm.googleapis.com/x", keys: {} }), false);
  assert.equal(estAppareilAndroid({ fcm: "" }), false);
  assert.equal(estAppareilAndroid(null), false);
});

test("compte de service : secret absent ou incomplet, les navigateurs restent servis", () => {
  assert.equal(lireCompteFcm(undefined), null);
  assert.equal(lireCompteFcm("pas du json"), null);
  assert.equal(lireCompteFcm('{"project_id":"x"}'), null);
  assert.equal(lireCompteFcm(JSON.stringify(COMPTE)).project_id, "citadelle-test");
});

test("appel : données de sonnerie, avec l'adresse qui décroche", () => {
  const d = donneesFcm({ titre: "x", url: "/?messagerie=c1", appel: { id: "a1", nom: "Mariama" } });
  assert.deepEqual(d, {
    type: "appel", appelId: "a1", nom: "Mariama",
    url: "https://edugest-gn.pages.dev/?messagerie=c1&repondre=a1",
  });
});

test("fin d'appel : la sonnerie s'arrête, sans rien d'autre", () => {
  assert.deepEqual(donneesFcm({ appelFin: "a1" }), { type: "appel-fin", appelId: "a1" });
});

test("notification ordinaire : texte et adresse complète", () => {
  assert.deepEqual(donneesFcm({ titre: "Bonjour", corps: "Message", url: "/?annonce=1" }), {
    type: "notification", titre: "Bonjour", corps: "Message", url: "https://edugest-gn.pages.dev/?annonce=1",
  });
});

test("FCM : uniquement du texte dans les données", () => {
  for (const d of [donneesFcm({ appel: { id: "a", nom: "b" } }), donneesFcm({ appelFin: "a" }), donneesFcm({})]) {
    assert.ok(Object.values(d).every((v) => typeof v === "string"));
  }
});

test("priorité : haute et courte pour un appel, normale sinon", () => {
  const appel = messageFcm("j", donneesFcm({ appel: { id: "a", nom: "b" } }));
  assert.equal(appel.message.token, "j");
  assert.deepEqual(appel.message.android, { priority: "HIGH", ttl: "60s" });
  assert.equal(messageFcm("j", donneesFcm({ appelFin: "a" })).message.android.priority, "HIGH");
  assert.deepEqual(messageFcm("j", donneesFcm({ titre: "t" })).message.android, { priority: "NORMAL" });
});

test("assertion Google : signée RS256 avec la clé du compte de service", async () => {
  const jwt = await assertionGoogle(COMPTE, 1000);
  const [entete, charge, signature] = jwt.split(".");
  assert.deepEqual(lire(entete), { alg: "RS256", typ: "JWT" });
  const c = lire(charge);
  assert.equal(c.iss, COMPTE.client_email);
  assert.equal(c.aud, "https://oauth2.googleapis.com/token");
  assert.equal(c.scope, "https://www.googleapis.com/auth/firebase.messaging");
  assert.equal(c.exp - c.iat, 3600);
  const controle = createVerify("RSA-SHA256");
  controle.update(`${entete}.${charge}`);
  assert.equal(controle.verify(publicKey, Buffer.from(signature, "base64url")), true);
});

test("jeton d'accès : échangé auprès de Google, refus remonté", async () => {
  let corps = null;
  const reussi = await jetonAcces(COMPTE, async (_url, o) => { corps = String(o.body); return { ok: true, json: async () => ({ access_token: "ya29" }) }; });
  assert.equal(reussi, "ya29");
  assert.match(corps, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
  await assert.rejects(jetonAcces(COMPTE, async () => ({ ok: false, status: 403 })));
});

test("envoi : réussite, application désinstallée, panne passagère", async () => {
  let adresse = "";
  const ok = await envoyerFcm(COMPTE, "t", {}, async (u) => { adresse = u; return { ok: true }; });
  assert.equal(ok, "ok");
  assert.equal(adresse, "https://fcm.googleapis.com/v1/projects/citadelle-test/messages:send");
  assert.equal(await envoyerFcm(COMPTE, "t", {}, async () => ({ ok: false, status: 404 })), "expire");
  assert.equal(await envoyerFcm(COMPTE, "t", {}, async () => ({ ok: false, status: 503 })), "echec");
});
