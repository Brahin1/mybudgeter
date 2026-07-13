// MyBudgeter service worker — cache-first so the app works fully offline.
// Bump CACHE_VERSION on every deploy that changes any asset.
const CACHE_VERSION = 'mybudgeter-v3';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/payoff.js',
  './js/alerts.js',
  './js/views/dashboard.js',
  './js/views/accounts.js',
  './js/views/transactions.js',
  './js/views/budgets.js',
  './js/views/payoffView.js',
  './js/views/more.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Cache same-origin responses so updated assets keep working offline.
        if (resp.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() =>
        // Offline navigation fallback: serve the app shell.
        event.request.mode === 'navigate' ? caches.match('./index.html') : undefined
      );
    })
  );
});
