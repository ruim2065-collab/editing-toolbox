// Service Worker for 剪辑接单百宝箱 v2.1
// Strategy: shell cache-first, data network-first, assets stale-while-revalidate
const CACHE_NAME = 'toolbox-v5';
const SHELL = [
  './',
  './index.html',
  './css/main.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
// JS modules to pre-cache
const MODULES = [
  './js/utils.js',
  './js/app.js',
  './js/data/talk-db.js',
  './js/data/font-db.js',
  './js/data/music-db.js',
  './js/data/sfx-db.js',
  './js/tools/quote.js',
  './js/tools/talk.js',
  './js/tools/revision.js',
  './js/tools/portfolio.js',
  './js/tools/material.js',
  './js/tools/benchmark.js',
  './js/tools/subtitle.js',
  './js/tools/fontguide.js',
  './js/tools/music.js',
  './js/tools/sfx.js',
  './js/tools/organize.js',
  './js/tools/contract.js'
];

// Install: pre-cache shell + modules
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        [...SHELL, ...MODULES].map(url =>
          cache.add(url).catch(err => console.log('SW: failed to cache', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: strategy by request type
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // API calls: network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Navigation / shell: network-first (to get latest), fallback to cache
  if (request.mode === 'navigate' || SHELL.some(s => url.pathname.endsWith(s.replace('./', '')))) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // JS modules & assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});

// Message handler for skipWaiting
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
