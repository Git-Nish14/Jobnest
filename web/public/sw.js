// Jobnest service worker — static-asset caching for fast repeat loads.
//
// SECURITY NOTE: Navigation responses (HTML pages) are intentionally NEVER
// cached. Dashboard HTML is user-specific; caching it would expose one user's
// data to the next person who opens the same browser (shared device).
// Only public static assets (JS/CSS/fonts/images) are cached.

const ASSET_CACHE = "jobnest-assets-v1";

// Static asset extensions safe to cache (Next.js hashes JS/CSS filenames,
// so cache-first is correct — stale bundles are impossible by design).
const STATIC_EXT = /\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|avif)(\?.*)?$/;

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", () => {
  // No pre-caching of navigation pages — they contain user data.
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
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

  // Navigation requests (page loads): always network, never cached.
  // This prevents stale/authenticated HTML from being served to the wrong user.
  if (request.mode === "navigate") return;

  // Static assets: cache-first, network fallback.
  // Next.js content-hashes JS/CSS so these files are immutable once cached.
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
