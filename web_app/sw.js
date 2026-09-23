const CACHE_NAME = 'srcc-classroom-v23';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js?v=23',
  '/data.js',
  '/faculty_leaves.js',
  '/teachers_data.js',
  '/assets/srcc_crest.png',
  '/assets/srcc_100years.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(err => console.warn('SW addAll err:', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Always fetch live on localhost or for dynamic APIs / JSON
  const isLocal = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocal || e.request.url.includes('.json') || e.request.url.includes('api')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
