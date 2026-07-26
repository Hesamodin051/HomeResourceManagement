// sw.js - نسخه پایدار با مدیریت خطا
const CACHE_NAME = 'tadbir-cache-v2';
const STATIC_URLS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/login.html',
    '/profile.html',
    '/food.html',
    '/energy.html',
    '/style.css',
    '/app.js',
    '/modules/auth.js',
    '/modules/store.js',
    '/modules/inventory.js',
    '/modules/consumption.js',
    '/modules/drawer.js',
    '/modules/dataLoader.js',
    '/modules/suggestion.js',
    '/modules/consumption-planner.js',
    '/modules/meal-planner.js',
    '/modules/ai.js',
    '/modules/chatbot.js',
    '/assets/data/recipes.json',
    '/assets/data/food_items.json',
    '/assets/data/crisis_scenarios.json'
];

// نصب با مدیریت خطا
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(STATIC_URLS).catch(err => {
                    console.warn('⚠️ برخی فایل‌ها در کش ذخیره نشدند:', err);
                    // ادامه می‌دهیم حتی اگر برخی فایل‌ها وجود نداشته باشند
                });
            })
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
                return fetch(event.request).catch(() => {
                    // در صورت خطا، یک پاسخ پیش‌فرض برمی‌گردانیم
                    return new Response('⛔ صفحه در حالت آفلاین در دسترس نیست.', {
                        status: 404,
                        statusText: 'Not Found'
                    });
                });
            })
    );
});
