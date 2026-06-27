// Service Worker for 剪辑接单百宝箱 PWA
const CACHE_NAME = 'toolbox-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache all core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        // Don't fail if some assets aren't available yet
        console.log('SW install: some assets not cached', err);
      });
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

// Fetch: cache-first strategy for app shell, network-first for everything else
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  if (event.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      // Return cached version immediately, then update cache in background
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // If network fails and we have nothing cached, return the main page
        return cached || caches.match('./index.html');
      });

      return cached || fetchPromise;
    })
  );
});
