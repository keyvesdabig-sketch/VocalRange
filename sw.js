const CACHE_NAME = 'voicecrack-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './manifest.json',
    './favicon.svg',
    './pitchEngine.js',
    './js/app.js',
    './js/pages/studio.js',
    './js/pages/vitals.js',
    './js/pages/arena.js',
    './js/pages/profile.js',
];

// Install: pre-cache all assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: cache-first, network fallback
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
