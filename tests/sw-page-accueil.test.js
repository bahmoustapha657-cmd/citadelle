// Le vrai public/sw.js, exécuté avec un faux navigateur : la page d'accueil
// est servie depuis l'appareil sans attendre le réseau, et sa copie n'est
// remplacée qu'une fois ses fichiers rangés dans le cache.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ORIGINE = "https://edugest.test";
const page = (version) =>
  `<html><link rel="modulepreload" href="/assets/vendor-${version}.js"><script type="module" src="/assets/index-${version}.js"></script></html>`;

function reponse(corps, { type = "text/html", ok = true, redirected = false } = {}) {
  return {
    ok, redirected, corps,
    headers: { get: (nom) => (nom.toLowerCase() === "content-type" ? type : null) },
    clone() { return reponse(corps, { type, ok, redirected }); },
    text: async () => corps,
  };
}
const script = (nom) => reponse(`// ${nom}`, { type: "text/javascript" });

// `serveur` : chemin → réponse, ou fonction (pour une requête qui ne répond jamais).
function chargerServiceWorker({ serveur = {}, cache = {} } = {}) {
  const ecouteurs = new Map();
  const stock = new Map(Object.entries(cache));
  const demandes = [];
  const cle = (r) => (typeof r === "string" ? r : new URL(r.url).pathname);
  const contexte = {
    self: {
      addEventListener: (nom, fn) => ecouteurs.set(nom, fn),
      location: { origin: ORIGINE },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
    console: { log: () => {} }, URL, AbortController,
    Response: function Response(corps, init) { return reponse(corps, { type: init?.headers?.["Content-Type"] }); },
    setTimeout, clearTimeout,
    caches: {
      open: async () => ({
        match: async (r) => stock.get(cle(r)),
        put: async (r, rep) => { stock.set(cle(r), rep); },
        addAll: async (liste) => { for (const u of liste) stock.set(u, reponse("icone", { type: "image/png" })); },
      }),
      keys: async () => [],
    },
    fetch: async (r) => {
      const chemin = cle(r);
      demandes.push(chemin);
      const prevu = serveur[chemin];
      if (typeof prevu === "function") return prevu();
      if (!prevu) throw new TypeError("Failed to fetch");
      return prevu.clone();
    },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), contexte);

  // Déclenche un événement ; renvoie la réponse servie et la fin du travail de fond.
  const emettre = (nom, evenement = {}) => {
    const fond = [];
    let servie;
    ecouteurs.get(nom)({ ...evenement, waitUntil: (p) => fond.push(p), respondWith: (p) => { servie = p; } });
    return { servie, fond: Promise.all(fond) };
  };
  const naviguer = (chemin) => emettre("fetch", {
    request: { url: ORIGINE + chemin, mode: "navigate", method: "GET" },
  });
  return { emettre, naviguer, stock, demandes };
}

const jamais = () => new Promise(() => {});
const fichiers = (v) => ({ [`/assets/vendor-${v}.js`]: script("vendor"), [`/assets/index-${v}.js`]: script("index") });

test("ouverture : la copie de l'appareil est servie même si le serveur ne répond jamais", async () => {
  const sw = chargerServiceWorker({ cache: { "/": reponse(page("v1")) }, serveur: { "/": jamais } });
  const { servie } = sw.naviguer("/?messagerie=1");
  const rep = await Promise.race([servie, new Promise((fin) => { setTimeout(() => fin("en attente"), 200); })]);
  assert.notEqual(rep, "en attente", "aucune attente du réseau");
  assert.equal(await rep.text(), page("v1"));
});

test("nouvelle version : ses fichiers sont rangés AVANT que la page d'accueil soit remplacée", async () => {
  let pageRemplaceeTropTot = false;
  const sw = chargerServiceWorker({
    cache: { "/": reponse(page("v1")) },
    serveur: {
      "/": reponse(page("v2")),
      "/assets/vendor-v2.js": script("vendor"),
      "/assets/index-v2.js": () => {
        pageRemplaceeTropTot = sw.stock.get("/").corps !== page("v1");
        return script("index");
      },
    },
  });
  const { servie, fond } = sw.naviguer("/");
  assert.equal(await (await servie).text(), page("v1"), "cette ouverture reste sur la copie de l'appareil");
  await fond;
  assert.equal(pageRemplaceeTropTot, false);
  assert.equal(sw.stock.get("/").corps, page("v2"), "la prochaine ouverture aura la nouvelle version");
  assert.ok(sw.stock.has("/assets/vendor-v2.js") && sw.stock.has("/assets/index-v2.js"));
});

test("fichier de la nouvelle version introuvable : l'ancienne page d'accueil reste", async () => {
  // Absent du réseau, remplacé par la page d'accueil (hébergeur), ou en erreur.
  for (const manquant of [undefined, reponse(page("v2")), reponse("", { ok: false, type: "text/plain" })]) {
    const sw = chargerServiceWorker({
      cache: { "/": reponse(page("v1")) },
      serveur: { "/": reponse(page("v2")), "/assets/vendor-v2.js": script("vendor"), "/assets/index-v2.js": manquant },
    });
    await sw.naviguer("/").fond;
    assert.equal(sw.stock.get("/").corps, page("v1"));
    assert.equal(sw.stock.has("/assets/index-v2.js"), false, "une page d'erreur n'est jamais rangée comme script");
  }
});

test("hors ligne : la copie est servie, rien n'est remplacé", async () => {
  const sw = chargerServiceWorker({ cache: { "/": reponse(page("v1")) } });
  const { servie, fond } = sw.naviguer("/index.html");
  assert.equal(await (await servie).text(), page("v1"));
  await fond;
  assert.equal(sw.stock.get("/").corps, page("v1"));
});

test("fichiers déjà sur l'appareil : seule la page d'accueil est relue", async () => {
  const sw = chargerServiceWorker({
    cache: { "/": reponse(page("v1")), ...fichiers("v1") },
    serveur: { "/": reponse(page("v1")) },
  });
  await sw.naviguer("/").fond;
  assert.deepEqual(sw.demandes, ["/"]);
});

test("aucune copie sur l'appareil : la page vient du réseau", async () => {
  const sw = chargerServiceWorker({ serveur: { "/": reponse(page("v1")), ...fichiers("v1") } });
  assert.equal(await (await sw.naviguer("/").servie).text(), page("v1"));
});

test("copie redirigée (ancien cache) : jamais servie à une navigation", async () => {
  const sw = chargerServiceWorker({
    cache: { "/": reponse(page("v0"), { redirected: true }) },
    serveur: { "/": reponse(page("v1")), ...fichiers("v1") },
  });
  assert.equal(await (await sw.naviguer("/").servie).text(), page("v1"));
});

test("autres pages (aide, pages publiques) : toujours le réseau d'abord", async () => {
  const sw = chargerServiceWorker({ cache: { "/": reponse(page("v1")) }, serveur: { "/aide": reponse("<h1>Aide</h1>") } });
  assert.equal(await (await sw.naviguer("/aide").servie).text(), "<h1>Aide</h1>");
});

test("installation : la page d'accueil est rangée avec ses fichiers, sinon l'installation échoue", async () => {
  const sw = chargerServiceWorker({ serveur: { "/": reponse(page("v1")), ...fichiers("v1") } });
  await sw.emettre("install").fond;
  assert.equal(sw.stock.get("/").corps, page("v1"));
  assert.ok(sw.stock.has("/assets/index-v1.js") && sw.stock.has("/icons/pwa-192.png?v=2"));

  const horsLigne = chargerServiceWorker();
  await assert.rejects(horsLigne.emettre("install").fond);
});

test("mise à jour automatique : le service worker rafraîchit la page d'accueil et répond", async () => {
  const demander = async (sw) => {
    let reponseSw;
    const { fond } = sw.emettre("message", {
      data: { type: "RAFRAICHIR_COQUE" }, ports: [{ postMessage: (m) => { reponseSw = m; } }],
    });
    await fond;
    return reponseSw;
  };
  const enLigne = chargerServiceWorker({
    cache: { "/": reponse(page("v1")) },
    serveur: { "/": reponse(page("v2")), ...fichiers("v2") },
  });
  assert.equal((await demander(enLigne)).ok, true);
  assert.equal(enLigne.stock.get("/").corps, page("v2"));

  const horsLigne = chargerServiceWorker({ cache: { "/": reponse(page("v1")) } });
  assert.equal((await demander(horsLigne)).ok, false);
});

// ── Modules chargés à la demande (Comptabilité, École…) ───────
const liste = (...chemins) => reponse(JSON.stringify(chemins), { type: "application/json" });
const ranger = (sw) => sw.emettre("message", { data: { type: "RANGER_MODULES" } }).fond;

test("modules : tous rangés d'avance, seuls les absents sont téléchargés", async () => {
  const sw = chargerServiceWorker({
    cache: { "/assets/compta-v1.js": script("compta") },
    serveur: {
      "/precache.json": liste("/assets/compta-v1.js", "/assets/ecole-v1.js", "/assets/notes-v1.css"),
      "/assets/ecole-v1.js": script("ecole"),
      "/assets/notes-v1.css": reponse("a{}", { type: "text/css" }),
    },
  });
  await ranger(sw);
  assert.deepEqual(sw.demandes.sort(), ["/assets/ecole-v1.js", "/assets/notes-v1.css", "/precache.json"]);
  assert.ok(sw.stock.has("/assets/ecole-v1.js") && sw.stock.has("/assets/notes-v1.css"));

  // Ouverture suivante, même version : seule la liste est relue.
  sw.demandes.length = 0;
  await ranger(sw);
  assert.deepEqual(sw.demandes, ["/precache.json"]);
});

test("modules : rangement interrompu, repris à l'ouverture suivante", async () => {
  const serveur = {
    "/precache.json": liste("/assets/compta-v2.js", "/assets/ecole-v2.js"),
    "/assets/compta-v2.js": script("compta"),
    // ecole-v2.js : réseau coupé en route.
  };
  const sw = chargerServiceWorker({ serveur });
  await ranger(sw);
  assert.ok(sw.stock.has("/assets/compta-v2.js"));
  assert.equal(sw.stock.has("/precache.json"), false, "rien n'est tenu pour acquis");

  serveur["/assets/ecole-v2.js"] = script("ecole");
  sw.demandes.length = 0;
  await ranger(sw);
  assert.deepEqual(sw.demandes.sort(), ["/assets/ecole-v2.js", "/precache.json"]);
  assert.ok(sw.stock.has("/assets/ecole-v2.js") && sw.stock.has("/precache.json"));
});

test("modules : une page d'erreur n'est jamais rangée comme module, une liste absente n'efface rien", async () => {
  const sw = chargerServiceWorker({
    serveur: { "/precache.json": liste("/assets/ancien.js", "/ailleurs.js"), "/assets/ancien.js": reponse(page("v1")) },
  });
  await ranger(sw);
  assert.equal(sw.stock.has("/assets/ancien.js"), false);
  assert.ok(!sw.demandes.includes("/ailleurs.js"), "hors de /assets/ : ignoré");

  // Hébergeur qui renvoie la page d'accueil à la place de la liste, ou hors ligne.
  for (const serveur of [{ "/precache.json": reponse(page("v1")) }, {}]) {
    const autre = chargerServiceWorker({ cache: { "/assets/compta-v1.js": script("compta") }, serveur });
    await ranger(autre);
    assert.ok(autre.stock.has("/assets/compta-v1.js"));
    assert.equal(autre.stock.has("/precache.json"), false);
  }
});
