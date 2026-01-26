/* Siddes Service Worker — safe shell caching + push notifications
 *
 * SAFETY RULES (Siddes non-negotiables):
 *  - Never cache /api/* (NetworkOnly). Service Worker caches are shared across a browser profile.
 *  - Never cache /m/* (NetworkOnly). Rely on HTTP caching for truly public media.
 *  - Never cache navigations or Next.js RSC/flight payloads (NetworkOnly + offline fallback for navigations only).
 *
 * Result: instant app shell + offline fallback, without any cross-user/Side cache contamination.
 */

const VERSION = "0.1.2";
const CORE_CACHE = `siddes-core-${VERSION}`;
const STATIC_CACHE = `siddes-static-${VERSION}`;

const CORE_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
];

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function networkOnly(request, fallbackUrl) {
  try {
    return await fetch(request);
  } catch (e) {
    if (fallbackUrl) {
      const fb = await caches.match(fallbackUrl);
      if (fb) return fb;
    }
    throw e;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE_CACHE);
      await cache.addAll(CORE_ASSETS).catch(() => {});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete any old Siddes caches (including any legacy API/media caches).
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k.startsWith("siddes-") && ![CORE_CACHE, STATIC_CACHE].includes(k)) {
            return caches.delete(k);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: never cache HTML. Network only; offline fallback to /offline.html.
  if (request.mode === "navigate") {
    event.respondWith(networkOnly(request, "/offline.html"));
    return;
  }

  if (!sameOrigin) return;

  // Core offline shell: safe to cache.
  if (url.pathname === "/offline.html") {
    event.respondWith(cacheFirst(request, CORE_CACHE));
    return;
  }

  // Next.js static build assets (hashed): safe to cache.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // PWA basics: safe to cache.
  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Private/personalized: NEVER cache in SW.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/m/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Default: NetworkOnly (prevents caching RSC/flight payloads and any other user-scoped responses).
  event.respondWith(fetch(request));
});

// ---- PUSH ----
// Expected payload (JSON):
// { title, body, url, side, glimpse, icon?, image? }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Siddes";
  const body = data.glimpse
    ? `${data.body || ""}
${data.glimpse}`.trim()
    : (data.body || "New activity");
  const url = data.url || "/siddes-notifications";
  const icon = data.icon || "/icons/icon-192.png";
  const image = data.image;

  const options = {
    body,
    icon,
    image,
    data: { url, side: data.side || "public" },
  };

  event.waitUntil(
  (async () => {
    // sd_737_app_badge_sw: set an app icon badge when a push arrives (supported browsers only).
    await self.registration.showNotification(title, options);

    try {
      const reg = self.registration;
      const setBadge = reg && typeof reg.setAppBadge === "function" ? reg.setAppBadge.bind(reg) : null;
      const clearBadge = reg && typeof reg.clearAppBadge === "function" ? reg.clearAppBadge.bind(reg) : null;

      if (setBadge || clearBadge) {
        const raw = data.badge ?? data.unread ?? data.count;
        const n = Number.isFinite(Number(raw)) ? Math.max(0, Math.floor(Number(raw))) : 1;
        if (n > 0 && setBadge) await setBadge(n);
        if (n <= 0 && clearBadge) await clearBadge();
      }
    } catch {
      // ignore badge errors
    }
  })()
);
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      // sd_737_badge_clear_on_click
      try {
        const reg = self.registration;
        if (reg && typeof reg.clearAppBadge === "function") {
          await reg.clearAppBadge();
        }
      } catch {}

      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of allClients) {
        if ("focus" in c) {
          c.focus();
          try { c.navigate(url); } catch {}
          return;
        }
      }
      if (clients.openWindow) await clients.openWindow(url);
    })()
  );
});
