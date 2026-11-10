/**
 * EduGest — Service Worker (PWA)
 * Stratégies de cache :
 *   Page d'accueil (/)       → copie de l'appareil aussitôt, rafraîchie en
 *                              arrière-plan avec ses fichiers (cf. rafraichirCoque)
 *   Fichiers hachés (JS/CSS) → CacheFirst ; tous les modules sont rangés
 *                              d'avance en arrière-plan (cf. rangerModules)
 *   Supabase Storage (photos, logos) → CacheFirst sans expiration
 * Les données (Supabase, PowerSync) ne passent pas par ce cache : le mode
 * hors ligne a son propre miroir local.
 */

const CACHE_APP    = "edugest-app-v11";
// Photos : noms SANS version, partagés avec src/photos-hors-ligne.js (qui y
// range les photos prises hors ligne). Un nom versionné serait effacé à la
// prochaine activation — et avec lui les photos pas encore envoyées.
// Les URL des photos sont immuables (nom aléatoire à chaque envoi).
const CACHE_PHOTOS         = "edugest-photos";
const CACHE_PHOTOS_ATTENTE = "edugest-photos-attente";

// ?v=2 : cache-busting du nouveau logo (les navigateurs cachent les favicons
// très longtemps ; les téléphones ne rafraîchissent l'icône PWA que si l'URL
// du manifest change). Garder en phase avec index.html et manifest.json.
const ICONES = [
  "/favicon.svg?v=2",
  "/icons/pwa-192.png?v=2",
  "/icons/pwa-512.png?v=2",
  "/icons/apple-touch-icon.png?v=2",
];

// ── Installation : mise en cache de l'app shell ───────────────
// La page d'accueil est rangée AVEC les fichiers qu'elle charge : dès la
// première visite, l'application peut se rouvrir sans réseau.
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => cache.addAll(ICONES))
      .then(() => rafraichirCoque({ strict: true }))
  );
  // skipWaiting : le nouveau SW prend la main IMMEDIATEMENT au lieu de rester
  // « en attente » derriere l'ancien. Sans cela, un utilisateur bloque sur une
  // ancienne version en cache (cf. login casse servi par un vieux SW) ne
  // recevait jamais la correction. Couple a clients.claim (activate) et au
  // rechargement unique sur controllerchange (sw-register.js), la mise a jour
  // se propage des le prochain chargement.
  self.skipWaiting();
});

// Permet au client de prendre la main sur le nouveau SW
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  // Mise à jour automatique (src/mise-a-jour) : avant de recharger la page
  // sur une nouvelle version, elle demande la page d'accueil à jour et attend
  // la réponse — sinon le rechargement resservirait l'ancienne copie.
  // Envoyé par la page quelques secondes après son ouverture (sw-register.js).
  if (e.data && e.data.type === "RANGER_MODULES") {
    e.waitUntil(rangerModules());
  }
  if (e.data && e.data.type === "RAFRAICHIR_COQUE") {
    const repondre = (ok) => e.ports && e.ports[0] && e.ports[0].postMessage({ ok });
    e.waitUntil(rafraichirCoque().then(repondre, () => repondre(false)));
  }
});

// ── Activation : nettoyage des vieux caches ───────────────────
self.addEventListener("activate", (e) => {
  // L'ancien cache « edugest-data-* » (réponses de l'API Vercel, retirée)
  // n'est plus gardé : il est vidé ici.
  const KEPT = [CACHE_APP, CACHE_PHOTOS, CACHE_PHOTOS_ATTENTE];
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEPT.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
  console.log("[SW] activated", CACHE_APP);
});

// ── Fetch : intercept toutes les requêtes ─────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // 1. Fichiers SEO / validation + /version.json (commit en ligne, lu par la
  //    CI après déploiement) + liste des modules → toujours réseau
  if (/sitemap\.xml|robots\.txt|google.*\.html|BingSiteAuth\.xml|^\/version\.json$|^\/precache\.json$/.test(url.pathname)) {
    return;
  }

  // 2. Supabase Storage public (photos d'élèves, logos) → CacheFirst sans
  // expiration. Supabase ne laisse le navigateur garder ces images qu'une
  // heure (max-age=3600) : hors ligne, elles disparaissaient. Les photos
  // prises hors ligne sont déjà dans ce cache (photos-hors-ligne.js).
  if (request.method === "GET" && /\.supabase\.co$/.test(url.hostname)
      && url.pathname.startsWith("/storage/v1/object/public/")) {
    e.respondWith(cacheFirst(request, CACHE_PHOTOS, Infinity));
    return;
  }

  // 3. Page d'accueil (l'application) → copie de l'appareil AUSSITÔT, sans
  //    attendre le réseau : en NetworkFirst, chaque ouverture attendait la
  //    réponse du serveur, jusqu'à 5 s d'écran blanc sur un réseau connecté
  //    mais sans internet. La copie est rafraîchie en arrière-plan ; la page
  //    passe à la nouvelle version seule (src/mise-a-jour, /version.json).
  if (request.mode === "navigate" && url.origin === self.location.origin && COQUE_CHEMINS.includes(url.pathname)) {
    e.respondWith(coqueDabord(request));
    e.waitUntil(rafraichirCoque().catch(() => false));
    return;
  }

  // 3 bis. Autres pages HTML (aide, pages publiques) → NetworkFirst
  if (request.mode === "navigate") {
    e.respondWith(networkFirst(request, CACHE_APP, 5000));
    return;
  }

  // 4. Assets statiques hachés (JS/CSS/images) → CacheFirst (safe car hash change à chaque build)
  if (url.origin === self.location.origin) {
    e.respondWith(appShellFirst(request));
    return;
  }
});

// ── Helpers ───────────────────────────────────────────────────

/** CacheFirst : renvoie le cache si disponible, sinon réseau puis stocke */
async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  // ignoreVary : une entrée rangée par la page (clé = URL seule) doit servir
  // aussi une requête <img crossOrigin> qui porte un en-tête Origin.
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) {
    const date = cached.headers.get("date");
    if (!date || (Date.now() - new Date(date).getTime()) < maxAgeSeconds * 1000) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok && request.method === "GET") cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response("Hors ligne", { status: 503 });
  }
}

/** NetworkFirst : réseau d'abord, fallback cache si timeout/erreur. */
async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(tid);
    if (response.ok && request.method === "GET") cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(
      JSON.stringify({ error: "Hors ligne", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ── Page d'accueil ────────────────────────────────────────────
// Rangée sous la clé "/" : /index.html est une redirection chez l'hébergeur,
// et une réponse redirigée ne peut pas servir une navigation.
const COQUE = "/";
const COQUE_CHEMINS = ["/", "/index.html"];
const DELAI_COQUE_MS = 20000;

/** Copie de l'appareil d'abord ; réseau seulement si elle manque. */
async function coqueDabord(request) {
  const cache = await caches.open(CACHE_APP);
  const cached = await cache.match(COQUE);
  if (cached && !cached.redirected) return cached;
  return networkFirst(request, CACHE_APP, 5000);
}

/** Fichiers /assets/ que la page charge au démarrage (scripts, styles, préchargements). */
function fichiersDeLaCoque(html) {
  const urls = new Set();
  const motif = /(?:src|href)="(\/assets\/[^"]+)"/g;
  for (let m = motif.exec(html); m; m = motif.exec(html)) urls.add(m[1]);
  return [...urls];
}

/**
 * Lit la page d'accueil sur le serveur et la range dans le cache, APRÈS les
 * fichiers qu'elle charge : la copie servie au prochain lancement peut
 * toujours démarrer sans réseau. Un fichier manquant → l'ancienne copie
 * reste. Une seule lecture à la fois. Renvoie true si la copie est à jour.
 * `strict` (installation) : lève au lieu de renvoyer false.
 */
let coqueEnCours = null;
function rafraichirCoque({ strict = false } = {}) {
  if (!coqueEnCours) {
    coqueEnCours = (async () => {
      // Borné : sur un réseau qui ne répond pas, la lecture ne doit pas
      // rester en vol et retenir les suivantes.
      const controle = new AbortController();
      const minuterie = setTimeout(() => controle.abort(), DELAI_COQUE_MS);
      const reponse = await fetch(COQUE, { cache: "no-store", signal: controle.signal })
        .finally(() => clearTimeout(minuterie));
      const type = reponse.headers.get("content-type") || "";
      if (!reponse.ok || reponse.redirected || !type.includes("text/html")) throw new Error("page d'accueil illisible");
      const html = await reponse.clone().text();
      const cache = await caches.open(CACHE_APP);
      await Promise.all(fichiersDeLaCoque(html).map(async (chemin) => {
        if (await cache.match(chemin)) return;
        const fichier = await fetch(chemin);
        // Fichier absent : l'hébergeur répond par la page d'accueil (200).
        const html404 = (fichier.headers.get("content-type") || "").includes("text/html");
        if (!fichier.ok || html404) throw new Error(`fichier manquant : ${chemin}`);
        await cache.put(chemin, fichier);
      }));
      await cache.put(COQUE, reponse);
      return true;
    })().finally(() => { coqueEnCours = null; });
  }
  return strict ? coqueEnCours : coqueEnCours.catch(() => false);
}

// ── Modules chargés à la demande ──────────────────────────────
// Tous les modules de l'application (liste publiée au build, /precache.json)
// sont rangés sur l'appareil en arrière-plan : après une mise à jour, un
// écran pas encore rouvert en ligne s'ouvre quand même sans réseau. Seuls les
// fichiers absents du cache sont téléchargés (ceux qu'une mise à jour a
// modifiés), deux à la fois pour ne pas gêner l'utilisation sur réseau
// faible. Interrompu (réseau, service worker endormi) : repris à la
// prochaine ouverture — la liste n'est gardée qu'une fois tout rangé.
const LISTE_MODULES = "/precache.json";
const MODULES_SIMULTANES = 2;
let modulesEnCours = null;
function rangerModules() {
  if (!modulesEnCours) {
    modulesEnCours = (async () => {
      const reponse = await fetch(LISTE_MODULES, { cache: "no-store" });
      const type = reponse.headers.get("content-type") || "";
      if (!reponse.ok || !type.includes("json")) return false;
      const texte = await reponse.text();
      const cache = await caches.open(CACHE_APP);
      const rangee = await cache.match(LISTE_MODULES);
      if (rangee && (await rangee.text()) === texte) return true; // déjà tout rangé
      const chemins = JSON.parse(texte).filter((c) => typeof c === "string" && c.startsWith("/assets/"));
      let complet = true;
      const suivant = async () => {
        for (let chemin = chemins.shift(); chemin; chemin = chemins.shift()) {
          try {
            if (await cache.match(chemin, { ignoreVary: true })) continue;
            const fichier = await fetch(chemin);
            // Fichier absent : l'hébergeur répond par la page d'accueil (200).
            const html404 = (fichier.headers.get("content-type") || "").includes("text/html");
            if (!fichier.ok || html404) { complet = false; continue; }
            await cache.put(chemin, fichier);
          } catch {
            complet = false;
          }
        }
      };
      await Promise.all(Array.from({ length: MODULES_SIMULTANES }, suivant));
      if (complet) await cache.put(LISTE_MODULES, new Response(texte, { headers: { "Content-Type": "application/json" } }));
      return complet;
    })().catch(() => false).finally(() => { modulesEnCours = null; });
  }
  return modulesEnCours;
}

/** App shell : cache d'abord, fallback index.html pour le routing SPA */
async function appShellFirst(request) {
  const cache = await caches.open(CACHE_APP);
  // ignoreVary : un fichier rangé d'avance par rafraichirCoque (requête du
  // service worker, sans en-tête Origin) doit servir aussi la requête de la
  // page (<script type="module" crossorigin>, qui en porte un).
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // SPA fallback : pour les routes React, on renvoie index.html
    if (request.mode === "navigate") {
      return cache.match("/index.html") ||
             new Response("<h1>EduGest — Hors ligne</h1>", { headers: { "Content-Type": "text/html" } });
    }
    return new Response("Hors ligne", { status: 503 });
  }
}

// ── Push notifications ────────────────────────────────────────
// Appel entrant : la notification vibre longuement et reste à l'écran. Si
// l'application est visible, son écran d'appel sonne déjà. Passé le délai de
// sonnerie, ce n'est plus qu'un appel manqué.
const TAG_APPEL = "appel-entrant";
const DUREE_APPEL_MS = 60000;

// Safari (iPhone, iPad, Mac) retire l'abonnement après trois poussées reçues
// sans notification affichée : l'appareil ne serait plus jamais prévenu. Là,
// chaque poussée affiche donc quelque chose, même application à l'écran.
function safariApple() {
  const ua = self.navigator?.userAgent || "";
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Android/.test(ua);
}

async function afficherAppel(titre, options) {
  const fenetres = await clients.matchAll({ type: "window", includeUncontrolled: true });
  if (fenetres.some((c) => c.visibilityState === "visible")) {
    // L'écran d'appel sonne déjà : simple rappel, jamais changé en « Appel
    // manqué » puisque l'appel se joue dans l'application.
    if (safariApple()) await self.registration.showNotification(titre, { ...options, tag: TAG_APPEL });
    return;
  }
  await self.registration.showNotification(titre, {
    ...options, tag: TAG_APPEL, renotify: true, requireInteraction: true,
    vibrate: [500, 250, 500, 250, 500, 250, 500, 250, 500],
  });
  await new Promise((fin) => { setTimeout(fin, DUREE_APPEL_MS); });
  const encore = await self.registration.getNotifications({ tag: TAG_APPEL });
  if (!encore.length) return; // touchée entre-temps
  await self.registration.showNotification(titre.replace(/ vous appelle$/, ""), {
    ...options, body: "Appel manqué", tag: TAG_APPEL, renotify: false, requireInteraction: false,
  });
}

self.addEventListener("push", (e) => {
  let data = { titre: "EduGest", corps: "", url: "/", icon: "/icons/pwa-192.png" };
  try { data = { ...data, ...JSON.parse(e.data?.text() || "{}") }; } catch { /* ignore malformed push payload */ }
  // L'Edge Function `push` envoie { title, body, url } : sans ce repli, toute
  // notification s'affichait « EduGest » sans texte.
  const titre = data.title || data.titre;
  const corps = data.body ?? data.corps;

  const options = {
    body:  corps,
    icon:  data.icon,
    badge: "/icons/pwa-192.png",
    data:  { url: data.url },
    vibrate: [200, 100, 200],
  };
  e.waitUntil(data.appel ? afficherAppel(titre, options) : self.registration.showNotification(titre, options));
});

// Clic sur la notification → ouvre l'app sur l'URL concernée
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) {
        // App déjà ouverte : elle ouvre elle-même la discussion / l'annonce
        // visée (messagerie interne) sans recharger la page.
        existing.postMessage({ type: "notification-click", url });
        return existing.focus();
      }
      return clients.openWindow(url);
    })
  );
});
