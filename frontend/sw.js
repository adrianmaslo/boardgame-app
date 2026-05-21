const CACHE_NAME = 'gamelog-pwa-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/state.js',
    '/js/utils.js',
    '/js/api.js',
    '/js/timer.js',
    '/js/ui-dashboard.js',
    '/js/ui-collection.js',
    '/js/ui-history.js',
    '/js/ui-profile.js',
    '/js/main.js',
    '/manifest.json?v=1',
    '/icons/icon.png?v=1'
];

// Install Event: Cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Network first, fallback to cache for API calls/dynamic content
// For static assets, we could do Cache First, but Network First is safer for now.
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
