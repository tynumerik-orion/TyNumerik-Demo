const CACHE_VERSION = "tynumerik-demo-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Pour la page principale et toutes les navigations :
  // Internet en priorité, cache seulement en secours hors ligne.
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html")
  ) {
    event.respondWith(
      (async () => {
        try {
          const freshResponse = await fetch(request, { cache: "no-store" });

          if (freshResponse && freshResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put("./index.html", freshResponse.clone());
          }

          return freshResponse;
        } catch (error) {
          const cache = await caches.open(STATIC_CACHE);

          return (
            (await cache.match("./index.html")) ||
            (await cache.match(request)) ||
            new Response(
              "Cette démo n'est pas disponible hors ligne pour le moment.",
              {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" }
              }
            )
          );
        }
      })()
    );

    return;
  }

  // Pour les fichiers statiques :
  // on affiche immédiatement le cache puis on le met à jour en arrière-plan.
  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(request);

      const networkPromise = fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || (await networkPromise) || Response.error();
    })()
  );
});
