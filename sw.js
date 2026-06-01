/* Tube Checker service worker.
 * Strategy:
 *   - App shell (HTML/navigation): NETWORK-FIRST, so updates land immediately when
 *     online; falls back to cache when offline.
 *   - Big immutable assets (Tesseract lib/worker/core, language model, icons):
 *     CACHE-FIRST, so they load instantly and work offline.
 * Bump CACHE when precached assets change. */
const CACHE = 'tube-checker-v9';

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/tesseract/tesseract.min.js',
  'vendor/tesseract/worker.min.js',
  'vendor/tesseract/tesseract-core.wasm.js',
  'vendor/tesseract/tesseract-core-simd.wasm.js',
  'vendor/tesseract/eng.traineddata.gz',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const isNavigation = req.mode === 'navigate' || req.destination === 'document';

  if (isNavigation) {
    // Network-first: always try to get the freshest app shell when online.
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => { c.put('index.html', copy); c.put('./', copy.clone()); });
          return res;
        })
        .catch(async () =>
          (await caches.match(req)) || (await caches.match('index.html')) || (await caches.match('./'))
        )
    );
    return;
  }

  // Cache-first for everything else (immutable, large).
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
