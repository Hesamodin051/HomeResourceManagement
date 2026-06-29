// sw.js
const CACHE_NAME = 'home-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/food.html',
    '/energy.html',
    '/profile.html',
    '/login.html',
    '/style.css',
    '/app.js',
    '/modules/auth.js',
    '/modules/store.js',
    '/modules/inventory.js',
    '/modules/consumption.js',
    '/modules/drawer.js',
    '/modules/dataLoader.js',
    '/modules/suggestions.js',
    '/modules/consumption-planner.js',
    '/modules/meal-planner.js',
    '/modules/ai.js',
    '/assets/data/food_items.json',
    '/assets/data/health_medication_items.json',
    '/assets/data/crisis_scenarios.json',
    '/assets/data/alert_messages.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request).then(fetchResponse => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone());
                        return fetchResponse;
                    });
                });
            })
    );
});
