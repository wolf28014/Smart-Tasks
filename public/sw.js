// Service worker for offline support of the TodoList app.
// Strategy: cache-first for static assets (JS/CSS/images),
// network-first with cache fallback for navigation (HTML) requests,
// and passthrough for API requests (data must be fresh, but if offline
// we serve cached responses to keep the UI usable).

const CACHE_VERSION = "todolist-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        "/",
        "/manifest.json",
      ]).catch(() => {}),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Next.js dev/HMR endpoints
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.includes("hot-update") ||
    url.pathname.startsWith("/_next/static/chunks/")
  ) {
    return;
  }

  // API requests: network-first, fall back to cache if offline
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET responses for offline use
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || new Response(
          JSON.stringify({ error: "离线模式，无法访问数据" }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ))),
    );
    return;
  }

  // Navigation requests: network-first, fall back to cached page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(PAGE_CACHE).then((cache) => {
            cache.put(request, clone).catch(() => {});
          });
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (r) =>
              r ||
              caches.match("/") ||
              new Response(
                "<html><body><h1>离线模式</h1><p>当前离线，且没有缓存的页面。</p></body></html>",
                { headers: { "Content-Type": "text/html; charset=utf-8" } },
              ),
          ),
        ),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return response;
        }),
    ),
  );
});
