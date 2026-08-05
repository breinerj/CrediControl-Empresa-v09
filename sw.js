const CACHE = "bkc-v1";

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

        caches.match(event.request)

            .then(response =>

                response || fetch(event.request)

            )

    );

});

