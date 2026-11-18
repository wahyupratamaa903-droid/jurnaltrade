const CACHE_NAME = 'jurnaltrade-shell-v7';
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/period_filter.js',
  './js/analytics.js',
  './js/trades.js',
  './js/risk_calc.js',
  './js/account_backup.js',
  './js/pair_presets.js',
  './js/ui_ux.js',
  './js/api_vault.js',
  './js/ai_copilot.js',
  './js/multimodal.js',
  './js/auth.js',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-First: Selalu ambil versi terbaru saat online, gunakan cache saat offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
