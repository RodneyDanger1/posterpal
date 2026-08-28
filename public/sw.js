/**
 * PosterPal service worker — makes the desk installable and resilient, without
 * ever serving stale data. Deliberately conservative because this app manages
 * real Facebook publishing:
 *
 *   - API / auth / server-fn requests: NEVER cached (always network). A stale
 *     draft, token, or session would be dangerous.
 *   - Navigations: network-first, falling back to the cached app shell only
 *     when truly offline (so an installed PWA opens instead of a browser error).
 *   - Static build assets (hashed JS/CSS, icons): cache-first (immutable).
 */
const CACHE = "posterpal-shell-v1";
const SHELL = ["/", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isNeverCache(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/__grok/") ||
    url.pathname.includes("/auth/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (Graph, CDNs)
  if (isNeverCache(url)) return; // always hit the network for data/auth

  // Navigations: network-first, fall back to cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then((r) => r || caches.match(request))),
    );
    return;
  }

  // Static assets: cache-first, then populate the cache on first fetch.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && (url.pathname.startsWith("/assets/") || SHELL.includes(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
