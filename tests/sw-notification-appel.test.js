// Le vrai public/sw.js, exécuté avec un faux navigateur : ce qu'il affiche à la
// réception d'une notification, selon que l'application est à l'écran ou non.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function chargerServiceWorker({ fenetres = [], cliquee = false } = {}) {
  const ecouteurs = new Map();
  const affichees = [];
  const self = {
    addEventListener: (nom, fn) => ecouteurs.set(nom, fn),
    location: { origin: "https://edugest.test" },
    skipWaiting: () => {},
    clients: { claim: async () => {} },
    registration: {
      showNotification: async (titre, options) => { affichees.push({ titre, ...options }); },
      // Notification toujours à l'écran, sauf si l'utilisateur l'a touchée.
      getNotifications: async ({ tag }) => (cliquee ? [] : affichees.filter((n) => n.tag === tag)),
    },
  };
  const contexte = {
    self, console, URL, URLSearchParams,
    clients: { matchAll: async () => fenetres, openWindow: async () => {} },
    caches: {},
    fetch: async () => ({}),
    // Le minuteur de fin d'appel passe aussitôt.
    setTimeout: (fn) => { fn(); return 0; },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), contexte);
  const recevoir = async (charge) => {
    const attente = [];
    ecouteurs.get("push")({ data: { text: () => JSON.stringify(charge) }, waitUntil: (p) => attente.push(p) });
    await Promise.all(attente);
  };
  return { recevoir, affichees };
}

const APPEL = { title: "📞 Mariama Diallo vous appelle", body: "Touchez pour répondre.", url: "/?messagerie=1", appel: true };

test("appel, application fermée : la notification insiste et reste à l'écran", async () => {
  const sw = chargerServiceWorker({ cliquee: true });
  await sw.recevoir(APPEL);
  assert.equal(sw.affichees.length, 1);
  const [n] = sw.affichees;
  assert.equal(n.titre, APPEL.title);
  assert.equal(n.requireInteraction, true);
  assert.equal(n.renotify, true);
  assert.ok(n.vibrate.length > 3, "le téléphone doit vibrer longuement");
  assert.equal(n.data.url, APPEL.url);
});

test("appel, application à l'écran : rien en double, l'écran d'appel sonne déjà", async () => {
  const sw = chargerServiceWorker({ fenetres: [{ visibilityState: "visible" }] });
  await sw.recevoir(APPEL);
  assert.equal(sw.affichees.length, 0);
});

test("appel, application en arrière-plan : la notification s'affiche", async () => {
  const sw = chargerServiceWorker({ fenetres: [{ visibilityState: "hidden" }], cliquee: true });
  await sw.recevoir(APPEL);
  assert.equal(sw.affichees.length, 1);
});

test("appel resté sans réponse : la notification devient un appel manqué", async () => {
  const sw = chargerServiceWorker();
  await sw.recevoir(APPEL);
  assert.equal(sw.affichees.length, 2);
  const manque = sw.affichees[1];
  assert.equal(manque.titre, "📞 Mariama Diallo");
  assert.equal(manque.body, "Appel manqué");
  assert.equal(manque.tag, sw.affichees[0].tag, "elle remplace la première");
  assert.equal(manque.requireInteraction, false);
  assert.equal(manque.renotify, false);
});

test("autres notifications : comportement inchangé", async () => {
  const sw = chargerServiceWorker({ fenetres: [{ visibilityState: "visible" }] });
  await sw.recevoir({ title: "Message", body: "Bonjour", url: "/" });
  assert.equal(sw.affichees.length, 1);
  assert.equal(sw.affichees[0].requireInteraction, undefined);
  assert.equal(sw.affichees[0].tag, undefined);
});
