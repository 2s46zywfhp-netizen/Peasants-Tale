// Generated at build time by the precache plugin in vite.config.ts. Do not edit dist/sw.js.
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const CACHE = `peasants-life-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('peasants-life-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // The page itself: from the network when there is one, so updates arrive at once; the precached
    // page only when offline (or the network takes more than three seconds).
    event.respondWith(
      new Promise((resolve) => {
        let done = false;
        const fallback = () => caches.match('/', { cacheName: CACHE }).then((r) => {
          if (!done && r) {
            done = true;
            resolve(r);
          }
        });
        const timer = setTimeout(fallback, 3000);
        fetch(req, { cache: 'no-store' })
          .then((r) => {
            clearTimeout(timer);
            if (!done && r.ok) {
              done = true;
              resolve(r);
            } else if (!done) fallback().then(() => !done && resolve(r));
          })
          .catch(() => {
            clearTimeout(timer);
            fallback().then(() => !done && resolve(Response.error()));
          });
      }),
    );
    return;
  }
  event.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req)));
});
