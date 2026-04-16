/**
 * EduGest — Service Worker (PWA)
 * Stratégies de cache :
 *   App shell (JS/CSS/HTML)  → CacheFirst + mise à jour en arrière-plan
 *   Firebase Storage (photos) → CacheFirst longue durée
 *   Firestore API             → NetworkFirst avec fallback cache
 *   Firebase Auth             → NetworkOnly (sécurité)
 *   API routes Vercel (/api/) → NetworkFirst avec fallback
 */

const CACHE_APP    = "edugest-app-v2";
const CACHE_DATA   = "edugest-data-v2";
const CACHE_PHOTOS = "edugest-photos-v2";

const APP_SHELL = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
  "/icons/apple-touch-icon.png",
];

// ── Installation : mise en cache de l'app shell ───────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_APP).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activation : nettoyage des vieux caches ───────────────────
self.addEventListener("activate", (e) => {
  const KEPT = [CACHE_APP, CACHE_DATA, CACHE_PHOTOS];
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KEPT.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch : intercept toutes les requêtes ─────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // 1. Firebase Auth → toujours réseau (jamais de cache)
  if (/identitytoolkit|securetoken/.test(url.hostname)) {
    return; // laisse passer sans intercepter
  }

  // 2. Firebase Storage (photos) → CacheFirst
  if (url.hostname === "firebasestorage.googleapis.com") {
    e.respondWith(cacheFirst(request, CACHE_PHOTOS, 30 * 24 * 60 * 60));
    return;
  }

  // 3. Firestore → NetworkFirst (fallback cache)
  if (url.hostname === "firestore.googleapis.com") {
    e.respondWith(networkFirst(request, CACHE_DATA, 5000));
    return;
  }

  // 4. API routes Vercel → NetworkFirst (fallback cache court)
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(networkFirst(request, CACHE_DATA, 8000));
    return;
  }

  // 5. Navigation HTML → NetworkFirst (toujours la dernière version)
  if (request.mode === "navigate") {
    e.respondWith(networkFirst(request, CACHE_APP, 5000));
    return;
  }

  // 6. Assets statiques hachés (JS/CSS/images) → CacheFirst (safe car hash change à chaque build)
  if (url.origin === self.location.origin) {
    e.respondWith(appShellFirst(request));
    return;
  }
});

// ── Helpers ───────────────────────────────────────────────────

/** CacheFirst : renvoie le cache si disponible, sinon réseau puis stocke */
async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    const date = cached.headers.get("date");
    if (!date || (Date.now() - new Date(date).getTime()) < maxAgeSeconds * 1000) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || new Response("Hors ligne", { status: 503 });
  }
}

/** NetworkFirst : réseau d'abord, fallback cache si timeout/erreur */
async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(tid);
    if (response.ok) cache.put(request, response.clone());
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
  try { data = { ...data, ...JSON.parse(e.data?.text() || "{}") }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.titre, {
      body:  data.corps,
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
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
