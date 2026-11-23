/* Service worker: makes the app installable and fully usable offline.
   Bump VERSION whenever you change any file so phones pick up the update. */
const VERSION = 'tis-bcs-prep-v3.0.0';
const APP_CACHE = 'app-' + VERSION;
const FONT_CACHE = 'fonts-v1';

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/data/config.js',
  './js/data/questions.sample.js',
  './js/core/ui.js',
  './js/core/storage.js',
  './js/core/qbank.js',
  './js/core/stats.js',
  './js/core/charts.js',
  './js/pwa.js',
  './js/app.js',
  './js/views/dashboard.js',
  './js/views/exam.js',
  './js/views/practice.js',
  './js/views/bank.js',
  './js/views/analysis.js',
  './js/views/progress.js',
  './js/views/settings.js',
  './js/views/profile.js',
  './assets/profile.jpg',
  './assets/tis-logo.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './templates/question-import-template.csv',
  './templates/question-import-template.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((c) => c.addAll(APP_FILES)));
  // the new version waits until the page asks it to take over (see "Update" toast)
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('app-') && k !== APP_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache-first so Bangla text renders offline after the first visit
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(FONT_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }
      catch (e) { return new Response('', { status: 503 }); }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App files: serve from cache instantly, fall back to network (and cache it).
  event.respondWith(caches.open(APP_CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') return cache.match('./index.html');
      return new Response('Offline', { status: 503 });
    }
  }));
});
