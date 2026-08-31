// Network-first for our own files, so a deploy reaches an installed app on the
// next online open. Asset filenames are content-hashed by the build, so there
// is no fixed precache list to keep in step -- whatever gets fetched is cached
// as it goes, and the cache is only consulted when the network fails.
const CACHE_NAME = 'personal-os-react-v1';
const SHELL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(['./', SHELL])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (new URL(request.url).origin !== self.location.origin) {
    // Firebase's CDN modules — let the network handle them.
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache real successes; an error response would poison the cache
        // and be served back on the next offline load.
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((c) => c || caches.match(SHELL))),
  );
});
