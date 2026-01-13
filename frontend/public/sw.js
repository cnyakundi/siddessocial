/* Siddes Service Worker (sd_015.1) — caching + push notifications
 *
 * Includes caching strategies plus:
 * - push handler (shows notification with glimpse)
 * - notificationclick handler (deep links)
 */

const VERSION = "sd015-1-v0.1.1";
const CORE_CACHE = `siddes-core-${VERSION}`;
const STATIC_CACHE = `siddes-static-${VERSION}`;
const IMG_CACHE = `siddes-img-${VERSION}`;
const API_CACHE = `siddes-api-${VERSION}`;

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

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fb = await caches.match(fallbackUrl);
      if (fb) return fb;
    }
    throw e;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response("", { status: 504 });
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
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (
            k.startsWith("siddes-") &&
            ![CORE_CACHE, STATIC_CACHE, IMG_CACHE, API_CACHE].includes(k)
          ) {
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

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, CORE_CACHE, "/offline.html"));
    return;
  }

  if (!sameOrigin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  const isImage =
    request.destination === "image" ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url.pathname);
  if (isImage) {
    event.respondWith(cacheFirst(request, IMG_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, STATIC_CACHE, null));
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

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
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
