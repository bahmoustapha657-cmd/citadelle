import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  abonnementAndroid, appelADecrocher, jetonAndroid, recevoirJetonAndroid,
} from "../src/backend/application-android.js";

// Faux navigateur : adresse, référent, stockage.
function page(href, referrer = "") {
  const url = new URL(href);
  const donnees = new Map();
  const env = {
    location: {
      get href() { return url.href; }, get hash() { return url.hash; },
      get pathname() { return url.pathname; }, get search() { return url.search; },
    },
    document: { referrer },
    localStorage: {
      getItem: (c) => (donnees.has(c) ? donnees.get(c) : null),
      setItem: (c, v) => donnees.set(c, v),
    },
    history: { replaceState: (_e, _t, adresse) => { const n = new URL(adresse, url); url.href = n.href; } },
  };
  return env;
}

const APP = "android-app://com.edugest.app/";

test("jeton : reçu de l'application, gardé, et retiré de l'adresse", () => {
  const env = page("https://edugest.test/?a=1#fcm=abc%3A123", APP);
  recevoirJetonAndroid(env);
  assert.equal(jetonAndroid(env), "abc:123");
  assert.equal(env.location.href, "https://edugest.test/?a=1");
});

test("jeton : un lien piégé ouvert dans le navigateur est ignoré, et nettoyé", () => {
  const env = page("https://edugest.test/#fcm=jeton-attaquant", "https://site-douteux.test/");
  recevoirJetonAndroid(env);
  assert.equal(jetonAndroid(env), null);
  assert.equal(env.location.hash, "");
});

test("jeton : un autre paquet Android n'est pas accepté", () => {
  const env = page("https://edugest.test/#fcm=x", "android-app://com.autre.appli/");
  recevoirJetonAndroid(env);
  assert.equal(jetonAndroid(env), null);
});

test("jeton : adresse sans fragment de jeton, rien ne change", () => {
  const env = page("https://edugest.test/#ailleurs", APP);
  recevoirJetonAndroid(env);
  assert.equal(env.location.hash, "#ailleurs");
  assert.equal(jetonAndroid(env), null);
});

test("abonnement Android : une adresse propre à l'appareil", () => {
  assert.deepEqual(abonnementAndroid("abc"), { endpoint: "fcm:abc", fcm: "abc" });
});

test("décrocher : honoré dans l'application, l'adresse est nettoyée", () => {
  const env = page("https://edugest.test/#fcm=x", APP);
  recevoirJetonAndroid(env);
  env.history.replaceState(null, "", "/?messagerie=c1&repondre=a1");
  assert.equal(appelADecrocher(env), "a1");
  assert.equal(env.location.search, "?messagerie=c1");
  assert.equal(appelADecrocher(env), null);
});

test("décrocher : ignoré dans un navigateur ordinaire, qui ne décroche pas sur un lien", () => {
  const env = page("https://edugest.test/?repondre=a1");
  assert.equal(appelADecrocher(env), null);
  assert.equal(env.location.search, "");
});

test("application Android : pas d'abonnement Web Push en plus de Firebase", () => {
  const push = readFileSync("src/backend/push-supabase.js", "utf8");
  assert.match(push, /jeton \? abonnementAndroid\(jeton\) : await abonnementNavigateur\(\)/);
});

test("application Android : le jeton est lu avant le démarrage de l'interface", () => {
  const main = readFileSync("src/main.jsx", "utf8");
  assert.ok(main.indexOf("recevoirJetonAndroid()") < main.indexOf("createRoot("));
});

test("manifeste : le paquet Android est celui qu'attend le site", () => {
  const gradle = readFileSync("android/app/build.gradle.kts", "utf8");
  assert.match(gradle, /applicationId = "com\.edugest\.app"/);
  const module = readFileSync("src/backend/application-android.js", "utf8");
  assert.match(module, /android-app:\/\/com\.edugest\.app/);
});
