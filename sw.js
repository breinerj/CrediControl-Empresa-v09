
const CACHE = "bkc-v4-liquidacion-diag";

const ARCHIVOS = [
    "./",
    "./index.html",
    "./css/style.css",
    "./js/app.js"
];

self.addEventListener("install", event => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(ARCHIVOS))
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(key =>
                            key.startsWith("bkc-") && key !== CACHE
                        )
                        .map(key => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (
        request.method !== "GET" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    event.respondWith(
        fetch(request, { cache: "no-cache" })
            .then(response => {
                if (response.ok) {
                    const copia = response.clone();

                    event.waitUntil(
                        caches.open(CACHE)
                            .then(cache => cache.put(request, copia))
                    );
                }

                return response;
            })
            .catch(async () => {
                const respuestaCache = await caches.match(request);

                if (respuestaCache) {
                    return respuestaCache;
                }

                return new Response(
                    "Recurso no disponible sin conexión.",
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8"
                        }
                    }
                );
            })
    );
});


