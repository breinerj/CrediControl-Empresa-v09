const CACHE = "bkc-v2";

const ARCHIVOS = [

    "./",

    "./index.html",

    "./css/style.css",

    "./js/app.js"

];

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE)

            .then(cache => cache.addAll(ARCHIVOS))

    );

});

self.addEventListener("fetch", event => {

    event.respondWith(

        fetch(event.request)

            .then(response => {

                const copia = response.clone();

                caches.open(CACHE)
                    .then(cache => {
                        cache.put(event.request, copia);
                    });

                return response;

            })

            .catch(() => {

                return caches.match(event.request);

            })

    );

});

