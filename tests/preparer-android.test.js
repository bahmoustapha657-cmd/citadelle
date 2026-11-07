import assert from "node:assert/strict";
import test from "node:test";

import { ligneEnv, verifierCompteService, verifierGoogleServices } from "../scripts/preparer-android.mjs";

const services = (paquet = "com.edugest.app", projet = "citadelle-school") => JSON.stringify({
  project_info: { project_id: projet },
  client: [{ client_info: { android_client_info: { package_name: paquet } } }],
});

const compte = (projet = "citadelle-school") => JSON.stringify({
  type: "service_account", project_id: projet, client_email: "x@y.iam", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
});

test("google-services.json : le bon paquet, sinon message clair", () => {
  assert.equal(verifierGoogleServices(services()), "citadelle-school");
  assert.throws(() => verifierGoogleServices(services("com.autre.appli")), /com\.edugest\.app/);
  assert.throws(() => verifierGoogleServices('{"client":[]}'), /com\.edugest\.app/);
});

test("clé de compte de service : refusée si elle vient d'un autre projet", () => {
  assert.doesNotThrow(() => verifierCompteService(compte(), "citadelle-school"));
  assert.throws(() => verifierCompteService(compte("autre"), "citadelle-school"), /autre/);
  assert.throws(() => verifierCompteService(services(), "citadelle-school"), /compte de service/);
});

test("secret Supabase : une ligne, et la clé privée revient intacte", () => {
  const ligne = ligneEnv(compte());
  assert.equal(ligne.trim().split("\n").length, 1);
  assert.match(ligne, /^FCM_SERVICE_ACCOUNT='\{/);
  const relu = JSON.parse(ligne.trim().replace(/^FCM_SERVICE_ACCOUNT='/, "").replace(/'$/, ""));
  assert.equal(relu.private_key, JSON.parse(compte()).private_key);
});
