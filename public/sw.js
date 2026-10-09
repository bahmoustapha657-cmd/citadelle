/**
 * EduGest — Service Worker (PWA)
 * Stratégies de cache :
 *   App shell (JS/CSS/HTML)  → CacheFirst + mise à jour en arrière-plan
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
const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.svg?v=2",
  "/icons/pwa-192.png?v=2",
  "/icons/pwa-512.png?v=2",
  "/icons/apple-touch-icon.png?v=2",
];

// ── Installation : mise en cache de l'app shell ───────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_APP).then((cache) => cache.addAll(APP_SHELL))
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
  //    CI après déploiement) → toujours réseau
  if (/sitemap\.xml|robots\.txt|google.*\.html|BingSiteAuth\.xml|^\/version\.json$/.test(url.pathname)) {
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

  // 3. Navigation HTML → NetworkFirst (toujours la dernière version)
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

/** App shell : cache d'abord, fallback index.html pour le routing SPA */
async function appShellFirst(request) {
  const cache = await caches.open(CACHE_APP);
  const cached = await cache.match(request);
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
self.addEventListener("push", (e) => {
  let data = { titre: "EduGest", corps: "", url: "/", icon: "/icons/pwa-192.png" };
  try { data = { ...data, ...JSON.parse(e.data?.text() || "{}") }; } catch { /* ignore malformed push payload */ }
  // L'Edge Function `push` envoie { title, body, url } : sans ce repli, toute
  // notification s'affichait « EduGest » sans texte.
  const titre = data.title || data.titre;
  const corps = data.body ?? data.corps;

  e.waitUntil(
    self.registration.showNotification(titre, {
      body:  corps,
      icon:  data.icon,
      badge: "/icons/pwa-192.png",
      data:  { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
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
