// Rappel des saisies restées sur l'appareil, EduGest fermé : la page laisse
// le compte au service worker et demande un réveil au retour du réseau
// (src/rappel-saisies.js) ; le vrai public/sw.js, exécuté avec un faux
// navigateur, affiche alors la notification (ou non).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  CACHE_RAPPEL, CLE_ATTENTE, RELANCE_MS, TAG_RAPPEL, creerRappelSaisies,
} from "../src/rappel-saisies.js";

const TEXTES = { titre: "📤 EduGest : 3 saisie(s) non envoyée(s)", corps: "Ouvrez EduGest pour les envoyer." };

// ── Côté page ────────────────────────────────────────────────────────────────

function fausseCache() {
  const stock = new Map();
  let ecritures = 0;
  return {
    stock,
    ecritures: () => ecritures,
    caches: {
      open: async (nom) => ({
        put: async (cle, reponse) => { ecritures += 1; stock.set(`${nom}${cle}`, await reponse.text()); },
      }),
    },
  };
}

function page({ enLigne = true, visible = true, permission = "granted", sync = true } = {}) {
  const stockage = fausseCache();
  const demandes = [];
  const fermees = [];
  let maintenant = 1_000_000;
  const affichee = { close: () => fermees.push(TAG_RAPPEL) };
  const reg = {
    sync: sync ? { register: async (tag) => { demandes.push(tag); } } : undefined,
    getNotifications: async ({ tag }) => (tag === TAG_RAPPEL ? [affichee] : []),
  };
  const env = {
    navigator: { onLine: enLigne, serviceWorker: { getRegistration: async () => reg } },
    document: { visibilityState: visible ? "visible" : "hidden" },
    caches: stockage.caches,
    Notification: { permission },
    maintenant: () => maintenant,
  };
  const memorise = () => {
    const texte = stockage.stock.get(`${CACHE_RAPPEL}${CLE_ATTENTE}`);
    return texte ? JSON.parse(texte) : null;
  };
  return {
    env, demandes, fermees, memorise, ecritures: stockage.ecritures,
    rappel: creerRappelSaisies(env),
    avancer: (ms) => { maintenant += ms; },
  };
}

test("page hors ligne avec des saisies : le compte est laissé au service worker et le rappel demandé une fois", async () => {
  const p = page({ enLigne: false });
  assert.equal(await p.rappel.suivre(3, TEXTES), "hors-ligne");
  assert.deepEqual(p.demandes, [TAG_RAPPEL]);
  assert.deepEqual(p.memorise(), { n: 3, ...TEXTES });
  // Le navigateur garde la demande jusqu'au retour du réseau : pas de doublon.
  assert.equal(await p.rappel.suivre(3, TEXTES), "");
  assert.equal(p.demandes.length, 1);
  assert.equal(p.ecritures(), 1, "rien n'est réécrit tant que le compte ne change pas");
  await p.rappel.suivre(4, TEXTES);
  assert.equal(p.memorise().n, 4);
  assert.equal(p.demandes.length, 1);
});

test("page en ligne et à l'écran : aucun rappel, EduGest envoie lui-même", async () => {
  const p = page();
  assert.equal(await p.rappel.suivre(2, TEXTES), "");
  assert.equal(p.demandes.length, 0);
  assert.equal(p.memorise().n, 2, "le compte est quand même laissé");
});

test("page en ligne passée en arrière-plan : rappel demandé, au plus une fois par intervalle", async () => {
  const p = page({ visible: false });
  assert.equal(await p.rappel.suivre(1, TEXTES), "arriere-plan");
  assert.equal(await p.rappel.suivre(1, TEXTES), "");
  p.avancer(RELANCE_MS - 1);
  assert.equal(await p.rappel.suivre(1, TEXTES), "");
  p.avancer(1);
  assert.equal(await p.rappel.suivre(1, TEXTES), "arriere-plan");
  assert.equal(p.demandes.length, 2);
});

test("coupure du réseau après un rappel en arrière-plan : nouvelle demande pour le retour du réseau", async () => {
  const p = page({ visible: false });
  await p.rappel.suivre(1, TEXTES);
  p.env.navigator.onLine = false;
  assert.equal(await p.rappel.suivre(1, TEXTES), "hors-ligne");
  assert.equal(p.demandes.length, 2);
});

test("retour à l'écran puis nouvelle coupure : nouvelle demande", async () => {
  const p = page({ enLigne: false });
  await p.rappel.suivre(1, TEXTES);
  p.env.navigator.onLine = true;
  await p.rappel.suivre(1, TEXTES);
  p.env.navigator.onLine = false;
  assert.equal(await p.rappel.suivre(1, TEXTES), "hors-ligne");
  assert.equal(p.demandes.length, 2);
});

test("tout est parti : compte à zéro et notification de rappel retirée", async () => {
  const p = page({ enLigne: false });
  await p.rappel.suivre(3, TEXTES);
  assert.equal(await p.rappel.suivre(0, TEXTES), "");
  assert.equal(p.memorise().n, 0);
  assert.deepEqual(p.fermees, [TAG_RAPPEL]);
  await p.rappel.suivre(0, TEXTES);
  assert.equal(p.fermees.length, 1, "retirée une seule fois");
});

test("EduGest rouvert sans toucher la notification : retirée dès le premier compte à zéro", async () => {
  const p = page();
  await p.rappel.suivre(0, TEXTES);
  assert.deepEqual(p.fermees, [TAG_RAPPEL]);
});

test("notifications non autorisées : aucun rappel demandé", async () => {
  for (const permission of ["default", "denied"]) {
    const p = page({ enLigne: false, permission });
    assert.equal(await p.rappel.suivre(3, TEXTES), "");
    assert.equal(p.demandes.length, 0);
  }
});

test("navigateur sans synchronisation en arrière-plan (Safari, Firefox) : rien, sans erreur", async () => {
  const p = page({ enLigne: false, sync: false });
  assert.equal(await p.rappel.suivre(3, TEXTES), "");
  const sansSw = creerRappelSaisies({ ...p.env, navigator: { onLine: false }, caches: undefined });
  assert.equal(await sansSw.suivre(3, TEXTES), "");
});

test("synchronisation en arrière-plan bloquée pour le site : redemandée au passage suivant", async () => {
  const p = page({ enLigne: false });
  let refus = true;
  p.env.navigator.serviceWorker.getRegistration = async () => ({
    sync: { register: async (tag) => { if (refus) throw new Error("NotAllowedError"); p.demandes.push(tag); } },
  });
  assert.equal(await p.rappel.suivre(3, TEXTES), "");
  refus = false;
  assert.equal(await p.rappel.suivre(3, TEXTES), "hors-ligne");
});

// ── Côté service worker ─────────────────────────────────────────────────────

function serviceWorker({ attente = null, apresAttente, fenetres = [], reseau = true, refuserNotification = false } = {}) {
  const ecouteurs = new Map();
  const affichees = [];
  const lectures = [];
  let contenu = attente;
  const contexte = {
    self: {
      addEventListener: (nom, fn) => ecouteurs.set(nom, fn),
      location: { origin: "https://edugest.test" },
      navigator: { userAgent: "Chrome Android" },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
      registration: {
        showNotification: async (titre, options) => {
          if (refuserNotification) throw new TypeError("No notification permission has been granted");
          affichees.push({ titre, ...options });
        },
      },
    },
    console: { log: () => {} }, URL,
    clients: { matchAll: async () => fenetres },
    caches: {
      open: async (nom) => ({
        match: async (cle) => (nom === CACHE_RAPPEL && cle === CLE_ATTENTE && contenu
          ? { json: async () => contenu } : undefined),
      }),
    },
    fetch: async (url) => {
      lectures.push(url);
      if (!reseau) throw new TypeError("Failed to fetch");
      return { ok: true };
    },
    // Le délai laissé à une page ouverte passe aussitôt ; elle a pu envoyer.
    setTimeout: (fn) => { if (apresAttente !== undefined) contenu = apresAttente; fn(); return 0; },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), contexte);
  const reveiller = async (tag = TAG_RAPPEL) => {
    const attentes = [];
    ecouteurs.get("sync")({ tag, waitUntil: (p) => attentes.push(p) });
    await Promise.all(attentes);
    return attentes.length;
  };
  return { reveiller, affichees, lectures };
}

test("réseau revenu, EduGest fermé, saisies en attente : la notification dit ce que c'est", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES } });
  await sw.reveiller();
  assert.equal(sw.affichees.length, 1);
  const [n] = sw.affichees;
  assert.equal(n.titre, TEXTES.titre);
  assert.equal(n.body, TEXTES.corps);
  assert.equal(n.tag, TAG_RAPPEL);
  assert.equal(n.renotify, false);
  assert.equal(n.data.url, "/");
  // Rien d'un appel : ni insistance, ni longue vibration.
  assert.equal(n.requireInteraction, undefined);
  assert.equal(n.vibrate, undefined);
});

test("texte absent (ancienne page) : titre et texte de secours explicites", async () => {
  const sw = serviceWorker({ attente: { n: 2 } });
  await sw.reveiller();
  assert.match(sw.affichees[0].titre, /saisies non envoyées/);
  assert.match(sw.affichees[0].body, /Ouvrez EduGest/);
});

test("rien en attente : ni lecture réseau ni notification", async () => {
  for (const attente of [null, { n: 0, ...TEXTES }]) {
    const sw = serviceWorker({ attente });
    await sw.reveiller();
    assert.equal(sw.affichees.length, 0);
    assert.equal(sw.lectures.length, 0);
  }
});

test("EduGest à l'écran : pas de notification, il envoie lui-même", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES }, fenetres: [{ visibilityState: "visible" }] });
  await sw.reveiller();
  assert.equal(sw.affichees.length, 0);
});

test("EduGest en arrière-plan qui n'a pas pu envoyer (téléphone) : la notification s'affiche", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES }, fenetres: [{ visibilityState: "hidden" }] });
  await sw.reveiller();
  assert.equal(sw.affichees.length, 1);
});

test("page restée ouverte qui envoie pendant le délai : pas de notification", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES }, apresAttente: { n: 0, ...TEXTES } });
  await sw.reveiller();
  assert.equal(sw.affichees.length, 0);
});

test("connecté sans internet : échec, pour que le navigateur réessaie plus tard", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES }, reseau: false });
  await assert.rejects(sw.reveiller());
  assert.equal(sw.affichees.length, 0);
});

test("notifications refusées : pas d'échec (le navigateur ne réessaierait pour rien)", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES }, refuserNotification: true });
  await sw.reveiller();
});

test("autre réveil que le rappel : ignoré", async () => {
  const sw = serviceWorker({ attente: { n: 3, ...TEXTES } });
  assert.equal(await sw.reveiller("autre-chose"), 0);
  assert.equal(sw.affichees.length, 0);
});

test("mise à jour de l'application : le compte laissé au service worker n'est pas effacé", async () => {
  const ecouteurs = new Map();
  const effaces = [];
  const contexte = {
    self: {
      addEventListener: (nom, fn) => ecouteurs.set(nom, fn),
      location: { origin: "https://edugest.test" }, skipWaiting: () => {}, clients: { claim: async () => {} },
    },
    console: { log: () => {} }, URL,
    caches: {
      keys: async () => [CACHE_RAPPEL, "edugest-photos", "edugest-app-v1"],
      delete: async (nom) => { effaces.push(nom); return true; },
    },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), contexte);
  const attentes = [];
  ecouteurs.get("activate")({ waitUntil: (p) => attentes.push(p) });
  await Promise.all(attentes);
  assert.deepEqual(effaces, ["edugest-app-v1"]);
});

test("mêmes noms dans la page et dans le service worker", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  const valeur = (nom) => sw.match(new RegExp(`const ${nom}\\s*=\\s*"([^"]+)"`))?.[1];
  assert.equal(valeur("CACHE_RAPPEL"), CACHE_RAPPEL);
  assert.equal(valeur("CLE_ATTENTE"), CLE_ATTENTE);
  assert.equal(valeur("TAG_RAPPEL"), TAG_RAPPEL);
});
