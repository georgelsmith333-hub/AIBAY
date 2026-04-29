// AIBAY Service Worker — Enables offline access and faster loading
const CACHE_NAME = "aibay-v1";
const STATIC_ASSETS = ["/", "/generate", "/supplier-finder", "/profit-calculator", "/market-research", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always go to network for fresh data
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request).catch(() => new Response("Offline", { status: 503 })));
    return;
  }

  // For navigation requests — serve from cache, fallback to network
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("/").then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // For static assets — cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || new Response("", { status: 404 }));
    })
  );
});
