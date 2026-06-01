/* Tube Checker service worker — precache the whole app for fully offline use.
 * Bump CACHE when any precached asset changes to force an update. */
const CACHE = 'tube-checker-v2';

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

// Precache everything on install.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Drop old caches on activate.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GETs; fall back to the network only if not cached.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // Runtime-cache anything else same-origin we fetch (defensive).
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
