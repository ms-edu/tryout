// public/sw.js
const CACHE_NAME = "tryout-cbt-v1";
const STATIC_ASSETS = [
  "/",
  "/exam",
  "/login",
  "/_next/static/css/app.css",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install: Cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Failed to cache some assets:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first for API, cache-first for static
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Don't intercept Supabase API calls (handle offline in app)
  if (url.hostname.includes("supabase.co")) {
    return;
  }

  // Cache-first for static assets
  if (
    event.request.method === "GET" &&
    (url.pathname.startsWith("/_next/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.json")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Network-first for pages
  if (event.request.method === "GET" && url.pathname.startsWith("/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

// Background sync for pending answers
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-answers") {
    event.waitUntil(syncPendingAnswers());
  }
  if (event.tag === "sync-finish") {
    event.waitUntil(syncFinish());
  }
});

async function syncPendingAnswers() {
  // Notify clients to sync
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_ANSWERS" });
  });
}

async function syncFinish() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_FINISH" });
  });
}

// Handle messages from app
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
