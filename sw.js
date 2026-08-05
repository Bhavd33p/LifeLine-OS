const CACHE_NAME = 'personal-os-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './icons.js',
  './sync.js',
  './firebase-config.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

/**
 * Network-first for our own files, cache-first for everything else.
 *
 * This used to be cache-first for everything, which meant a deployed fix only
 * reached an installed app if CACHE_NAME was also bumped by hand — forget that
 * once and users are pinned to stale code indefinitely (it served a stale
 * firebase-config.js during setup, which is what surfaced this). Going to the
 * network first costs nothing when online and still falls back to the cache
 * when offline, so the PWA keeps working on a plane.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isOwnAsset = url.origin === self.location.origin;

  if (!isOwnAsset) {
    // Firebase's CDN modules and the contest APIs — let the network handle
    // these, with whatever the browser already cached as the fallback.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache real successes; an opaque or error response would poison
        // the cache and get served back on the next offline load.
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
  );
});
