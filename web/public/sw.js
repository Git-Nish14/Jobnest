// Jobnest service worker — static-asset caching + offline fallback.
//
// SECURITY NOTE: Successful navigation responses (HTML pages) are intentionally
// NEVER cached. Dashboard HTML is user-specific; caching it would expose one
// user's data to the next person who opens the same browser (shared device).
// Only public static assets (JS/CSS/fonts/images) are cached.
//
// The /offline page is pre-cached during install as a safe fallback because it
// contains no user data — it is a fully static branded error page.

const ASSET_CACHE   = "jobnest-assets-v2";
const OFFLINE_CACHE = "jobnest-offline-v2";
const OFFLINE_URL   = "/offline";

// Static asset extensions safe to cache (Next.js content-hashes JS/CSS
// filenames so cache-first is correct — stale bundles are impossible).
const STATIC_EXT = /\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|avif)(\?.*)?$/;

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== ASSET_CACHE && k !== OFFLINE_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignore non-GET and cross-origin requests.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes — always network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests: network-first so users always get fresh, personalised
  // HTML. If the network is unreachable, serve the pre-cached offline page.
  // Successful responses are NOT stored so no user-specific HTML is ever cached.
  //
  // The null-guard (.then(r => r || ...)) handles the edge case where the
  // offline cache is empty (e.g. install failed or cache was cleared externally).
  // Without it, event.respondWith(undefined) is an invalid SW response that
  // throws a TypeError and shows the browser's default offline error instead.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })
          .then(
            (r) =>
              r ||
              new Response("You are offline. Please check your connection.", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              })
          )
      )
    );
    return;
  }

  // Static assets: cache-first, network fallback, cache on miss.
  if (STATIC_EXT.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
  }
});
