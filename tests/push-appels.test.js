// Prévenir d'un appel quand l'application est fermée : état de l'appareil,
// priorité de l'envoi, un abonnement par appareil.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { etatNotifications } from "../src/backend/push-navigateur.js";
import { OPTIONS_APPEL } from "../supabase/functions/push/destinataires.ts";

const appareil = (permission) => ({ navigator: { serviceWorker: {} }, PushManager: class {}, Notification: { permission } });

test("notifications : l'état de l'appareil décide du bandeau", () => {
  assert.equal(etatNotifications(appareil("granted")), "granted");
  assert.equal(etatNotifications(appareil("default")), "default");
  assert.equal(etatNotifications(appareil("denied")), "denied");
});

test("notifications : navigateur sans Web Push, iPhone hors écran d'accueil", () => {
  assert.equal(etatNotifications({ navigator: {} }), "indisponible");
  const { PushManager, ...sansPush } = appareil("default");
  assert.ok(PushManager);
  assert.equal(etatNotifications(sansPush), "indisponible");
  assert.equal(etatNotifications({}), "indisponible");
});

test("appel : envoi en priorité haute, inutile après la sonnerie", () => {
  assert.equal(OPTIONS_APPEL.urgency, "high");
  assert.ok(OPTIONS_APPEL.TTL >= 45 && OPTIONS_APPEL.TTL <= 120);
});

test("appel : la notification part avec le drapeau d'appel, le délai suit la sonnerie", () => {
  const appels = readFileSync("src/components/messagerie/audio/use-appels.js", "utf8");
  assert.match(appels, /\{ appel: \{ id, nom: nomMoi \|\| "Un collègue" \} \}\);/);
  const delai = Number(appels.match(/DELAI_SONNERIE_MS = (\d+);/)[1]);
  const backend = readFileSync("src/backend/messagerie-supabase.js", "utf8");
  assert.equal(Number(backend.match(/appelsEntrantsEnAttente\(moi, depuisMs = (\d+)\)/)[1]), delai);
  const sw = readFileSync("public/sw.js", "utf8");
  assert.equal(Number(sw.match(/DUREE_APPEL_MS = (\d+);/)[1]), delai);
});

test("appel : au retour dans l'application, on revérifie ce qui sonne", () => {
  const appels = readFileSync("src/components/messagerie/audio/use-appels.js", "utf8");
  assert.match(appels, /addEventListener\("visibilitychange", surRetour\)/);
  assert.match(appels, /removeEventListener\("visibilitychange", surRetour\)/);
});

test("abonnement : un appareil de plus, et non un appareil à la place de l'autre", () => {
  const nom = readdirSync("supabase/migrations").find((f) => f.endsWith("_push_subs_plusieurs_appareils.sql"));
  const sql = readFileSync(`supabase/migrations/${nom}`, "utf8");
  assert.match(sql, /primary key \(ecole_id, user_id, endpoint\)/);
  assert.match(sql, /generated always as \(subscription->>'endpoint'\) stored not null/);
  const edge = readFileSync("supabase/functions/push/index.ts", "utf8");
  assert.match(edge, /aSupprimer\.push\(s\.subscription\.endpoint\)/);
  assert.match(edge, /\.in\("endpoint", lot\)/);
});

test("abonnement : renouvelé à chaque ouverture, sans demande quand c'est déjà autorisé", () => {
  const push = readFileSync("src/backend/push-supabase.js", "utf8");
  const rafraichir = push.slice(push.indexOf("export async function rafraichirAbonnementPush"), push.indexOf("export async function seDesabonnerDesPush"));
  assert.match(rafraichir, /etatNotifications\(\) === "granted"/);
  assert.doesNotMatch(rafraichir, /requestPermission/);
  const contexte = readFileSync("src/components/messagerie/MessagerieContext.jsx", "utf8");
  assert.match(contexte, /rafraichirAbonnementPush\(utilisateur, schoolCode\)/);
});
