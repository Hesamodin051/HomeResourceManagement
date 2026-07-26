// sw.js
const CACHE_NAME = 'tadbir-v1';
const STATIC_URLS = ['/', '/index.html', '/dashboard.html', '/style.css', '/app.js', '/manifest.json'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_URLS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
