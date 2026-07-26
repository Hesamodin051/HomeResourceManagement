// sw.js
const CACHE_NAME = 'tadbir-home-v1';
const STATIC_URLS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/login.html',
    '/profile.html',
    '/food.html',
    '/energy.html',
    '/reports.html',
    '/notifications.html',
    '/help.html',
    '/contact.html',
    '/chat-history.html',
    '/medications.html',
    '/style.css',
    '/app.js',
    '/menu.js',
    '/chatbot-widget.js',
    '/manifest.json',
    '/favicon.ico'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_URLS).catch(err => {
                console.warn('⚠️ برخی فایل‌ها در کش ذخیره نشدند:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) return response;
            return fetch(event.request).catch(() => {
                return new Response('⛔ صفحه در حالت آفلاین در دسترس نیست.', {
                    status: 404,
                    statusText: 'Not Found'
                });
            });
        })
    );
});
