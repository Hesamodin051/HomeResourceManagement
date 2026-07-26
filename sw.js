// sw.js
self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
    event.respondWith(fetch(event.request).catch(function() {
        return new Response('⛔ صفحه در حالت آفلاین در دسترس نیست.', {
            status: 404,
            statusText: 'Not Found'
        });
    }));
});
