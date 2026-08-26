// AeroSense PWA Service Worker v5
const CACHE_NAME = 'aerosense-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css?v=5',
  '/app.js?v=5',
  '/manifest.json',
  '/icon.png',
  '/favicon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Always fetch API and dynamically updated assets over the network first
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const respClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
